const cds = require('@sap/cds');
const { SELECT, UPDATE } = require('@sap/cds/lib/ql/cds-ql');
const { executeHttpRequest } = require("@sap-cloud-sdk/http-client");
const ExcelJS = require('exceljs');

module.exports = cds.service.impl(async function () {

        const {
        TemplateMaster,
        TemplateFieldMapping,
        TemplateRule,
        FieldMaster,
        Transformation,
        TargetApiField
    } = cds.entities('lockbox.templatebuilder');

    // ================================================================
    // GET AVAILABLE RULES FROM RULE ENGINE
    // ================================================================
    this.on("getAvailableRules", async (req) => {
    try {
        const jwt = req.http?.req?.headers?.authorization?.replace(/^Bearer /i, "");

        const response = await executeHttpRequest(
            { destinationName: "LockBoxRulesDestination", jwt },
            { method: "GET", url: "/odata/v4/rules/Rules" }
        );

        const rules = response.data.value || [];
        return rules.map(rule => ({
            ID: rule.ID,
            ruleId: rule.ruleId,
            ruleName: rule.description,
            description: rule.description,
            actionType: rule.actionType
        }));
    } catch (err) {
        console.error(err);
        return req.error(500, "Unable to fetch Rules from Rule Service.");
    }
});

    // ================================================================
    // AFTER READ — compute mappingsCount virtual field on TemplateMaster
    // ================================================================
    this.after('READ', 'TemplateMaster', async (data) => {
        const rows = Array.isArray(data) ? data : (data ? [data] : []);
        if (!rows.length) return;

        const ids = rows.map(r => r.ID).filter(Boolean);
        if (!ids.length) return;

        const counts = await SELECT
            .from(TemplateFieldMapping)
            .columns('template_ID', { func: 'count', args: ['*'], as: 'count' })
            .where({ template_ID: { in: ids } })
            .groupBy('template_ID');

        const countMap = {};
        counts.forEach(c => { countMap[c.template_ID] = c.count; });
        rows.forEach(r => { r.mappingsCount = countMap[r.ID] || 0; });
    });

    

    // ================================================================
    // AUTO MAP STANDARD — copies field mapping settings from standard
    // (sheet, transformation, targetApiField, semanticRole)
    // ================================================================
        // ================================================================
    // AUTO MAP STANDARD — copies field mapping settings from standard
    // (sheet, transformation_ID, targetApiField_ID, semanticRole)
    // ================================================================
    this.on('autoMapStandard', async (req) => {
        const { targetTemplateId } = req.data;
        if (!targetTemplateId) return req.error(400, 'Target template ID is required.');

        const standardTemplate = await SELECT.one.from(TemplateMaster).where({ isStandard: true });
        if (!standardTemplate)
            return req.error(404, 'No standard template has been configured yet.');
        if (standardTemplate.ID === targetTemplateId)
            return req.error(400, 'Target template is already the standard template.');

        const standardMappings = await SELECT
            .from(TemplateFieldMapping)
            .where({ template_ID: standardTemplate.ID });
        if (!standardMappings?.length)
            return req.error(404, 'Standard template has no mappings configured.');

        const targetMappings = await SELECT
            .from(TemplateFieldMapping)
            .where({ template_ID: targetTemplateId });
        if (!targetMappings?.length)
            return req.error(400, 'Target template has no fields added yet. Please add fields first.');

        const standardLookup = {};
        standardMappings.forEach(m => {
            standardLookup[m.field_ID] = {
                sheet:              m.sheet,
                transformation_ID:  m.transformation_ID,
                targetApiField_ID:  m.targetApiField_ID,
                semanticRole:       m.semanticRole,
            };
        });

        let mappedCount = 0;
        let sequenceCounter = 1;
        for (const targetMapping of targetMappings) {
            const match = standardLookup[targetMapping.field_ID];
            if (!match) continue;

            await cds.run(
                UPDATE(TemplateFieldMapping).set({
                    sheet:             match.sheet,
                    transformation_ID: match.transformation_ID,
                    targetApiField_ID: match.targetApiField_ID,
                    semanticRole:      match.semanticRole,
                    sequenceNo:        sequenceCounter++,
                    status:            'OK',
                    statusDetail:      null,
                }).where({ ID: targetMapping.ID })
            );
            mappedCount++;
        }

        console.log(`AutoMap Standard: ${mappedCount} of ${targetMappings.length} fields mapped.`);
        return true;
    });
    // ================================================================
    // BEFORE CREATE TemplateMaster — auto-append "_Temp" suffix to name
    // ================================================================
    this.before('CREATE', 'TemplateMaster', async (req) => {
        const data = req.data;
        if (!data?.templateName) return;

        const name = String(data.templateName).trim();
        if (!name.endsWith('_Temp')) {
            data.templateName = `${name}_Temp`;
            console.log(`[TEMPLATE] Auto-appended suffix: "${name}" → "${data.templateName}"`);
        }
    });

        // ================================================================
    // AFTER READ — compute statusCriticality virtual field for
    // TemplateFieldMapping (drives Status column color in the UI)
    // ================================================================
    this.after('READ', 'TemplateFieldMapping', (data) => {
        const rows = Array.isArray(data) ? data : (data ? [data] : []);
        if (!rows.length) return;

        const criticalityMap = {
            OK: 3,       // green
            WARNING: 2,  // orange
            ERROR: 1     // red
        };

        rows.forEach(r => {
            r.statusCriticality = criticalityMap[r.status] ?? 0; // 0 = neutral/grey fallback
        });
    });

    // ================================================================
    // AFTER CREATE TemplateMaster — auto-seed mappings from standard
    // ================================================================
        // ================================================================
    // AFTER CREATE TemplateMaster — auto-seed mappings from standard
    // ================================================================
    this.after('CREATE', 'TemplateMaster', async (data) => {
        if (!data?.ID) return;

        const standardTemplate = await SELECT.one.from(TemplateMaster).where({ isStandard: true });
        if (!standardTemplate || standardTemplate.ID === data.ID) return;

        const standardMappings = await SELECT
            .from(TemplateFieldMapping)
            .where({ template_ID: standardTemplate.ID });

        const targetMappings = await SELECT
            .from(TemplateFieldMapping)
            .where({ template_ID: data.ID });

        if (standardMappings?.length && targetMappings?.length) {
            const standardLookup = {};
            standardMappings.forEach(m => {
                standardLookup[m.field_ID] = {
                    sheet:              m.sheet,
                    transformation_ID:  m.transformation_ID,
                    targetApiField_ID:  m.targetApiField_ID,
                    semanticRole:       m.semanticRole,
                };
            });

            let sequenceCounter = 1;
            for (const targetMapping of targetMappings) {
                const match = standardLookup[targetMapping.field_ID];
                if (!match) continue;
                await cds.run(
                    UPDATE(TemplateFieldMapping).set({
                        sheet:             match.sheet,
                        transformation_ID: match.transformation_ID,
                        targetApiField_ID: match.targetApiField_ID,
                        semanticRole:      match.semanticRole,
                        sequenceNo:        sequenceCounter++,
                    }).where({ ID: targetMapping.ID })
                );
            }
        }
    });

    // ================================================================
    // AUTO MAP AI — AI suggests targetApiField + semanticRole
    // ================================================================
        // ================================================================
    // AUTO MAP AI — AI suggests a targetApiField (matched against the
    // TargetApiField master list, not invented text) + semanticRole
    // ================================================================
    this.on('autoMapAi', async (req) => {
        const { templateId } = req.data;

        const unmappedMappings = await SELECT
            .from(TemplateFieldMapping)
            .where({ template_ID: templateId, targetApiField_ID: null })
            .columns('ID', 'field_ID');

        if (!unmappedMappings.length) return true;

        const fieldIds = unmappedMappings.map(m => m.field_ID);
        const fields = await SELECT
            .from(FieldMaster)
            .where({ ID: { in: fieldIds } })
            .columns('ID', 'fieldName', 'dataType');

        const fieldMap = {};
        fields.forEach(f => { fieldMap[f.ID] = f; });

        // Pull the actual master list so the AI can only pick from what exists
        const apiFieldOptions = await SELECT.from(TargetApiField).columns('ID', 'apiFieldName');
        const apiFieldByName = {};
        apiFieldOptions.forEach(a => { apiFieldByName[a.apiFieldName.toLowerCase()] = a.ID; });

        const fieldList = unmappedMappings.map((m, i) => {
            const f = fieldMap[m.field_ID] || {};
            return `${i + 1}. fieldName: ${f.fieldName || ''}, dataType: ${f.dataType || ''}`;
        }).join('\n');

        const prompt = `You are an SAP Lockbox payment mapping assistant.
Given these source fields, suggest the most appropriate SAP API field name and semantic role for each.
Available SAP API fields: ${apiFieldOptions.map(a => a.apiFieldName).join(', ')}.
Available semantic roles: AMOUNT, DATE, REFERENCE, PARTY, CODE, TEXT.
Respond ONLY with a JSON array in this exact format, no explanation:
[{"fieldName":"...","suggestedApiField":"...","suggestedRole":"..."}]

Fields to map:\n${fieldList}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            }
        );

        const geminiData = await response.json();
        let text = geminiData.candidates[0].content.parts[0].text;
        text = text.replace(/```json|```/g, '').trim();
        const suggestions = JSON.parse(text);

        const suggestionMap = {};
        suggestions.forEach(s => { suggestionMap[s.fieldName] = s; });

        for (const mapping of unmappedMappings) {
            const field = fieldMap[mapping.field_ID];
            const suggestion = field && suggestionMap[field.fieldName];
            if (!suggestion) continue;

            // Only apply if the suggested API field actually exists in the
            // master list — never write free text into an association FK.
            const matchedApiFieldId = apiFieldByName[(suggestion.suggestedApiField || '').toLowerCase()];
            if (!matchedApiFieldId) {
                console.warn(`AI suggested unknown API field "${suggestion.suggestedApiField}" for ${field.fieldName} — skipped.`);
                continue;
            }

            await cds.run(
                UPDATE(TemplateFieldMapping)
                    .set({
                        targetApiField_ID: matchedApiFieldId,
                        semanticRole:      suggestion.suggestedRole,
                    })
                    .where({ ID: mapping.ID })
            );
        }

        return true;
    });

        // ================================================================
    // AFTER READ — compute usageCount virtual field on TargetApiField
    // ================================================================
    this.after('READ', 'TargetApiField', async (data) => {
        const rows = Array.isArray(data) ? data : (data ? [data] : []);
        if (!rows.length) return;

        const ids = rows.map(r => r.ID).filter(Boolean);
        if (!ids.length) return;

        const counts = await SELECT
            .from(TemplateFieldMapping)
            .columns('targetApiField_ID', { func: 'count', args: ['*'], as: 'count' })
            .where({ targetApiField_ID: { in: ids } })
            .groupBy('targetApiField_ID');

        const countMap = {};
        counts.forEach(c => { countMap[c.targetApiField_ID] = c.count; });
        rows.forEach(r => { r.usageCount = countMap[r.ID] || 0; });
    });

    // ================================================================
    // REORDER RULES — resequence template-level rules
    // ================================================================
    this.on('reorderRules', async (req) => {
        const { templateId, orderedRuleIds } = req.data;
        if (!templateId || !orderedRuleIds?.length)
            return req.error(400, 'templateId and orderedRuleIds are required.');

        for (let i = 0; i < orderedRuleIds.length; i++) {
            await cds.run(
                UPDATE(TemplateRule)
                    .set({ sequenceNo: i + 1 })
                    .where({ ID: orderedRuleIds[i], template_ID: templateId })
            );
        }
        return true;
    });

    // ================================================================
    // SET AS STANDARD
    // ================================================================
    this.on('setAsStandard', async (req) => {
        const { templateId } = req.data;

        const template = await SELECT.one.from(TemplateMaster).where({ ID: templateId });
        if (!template) return req.error(404, 'Template not found.');

        await cds.run(UPDATE(TemplateMaster).set({ isStandard: false }));
        await cds.run(UPDATE(TemplateMaster).set({ isStandard: true }).where({ ID: templateId }));
        return true;
    });

    // ================================================================
    // GUARD 1 — Prevent deletion of the standard template
    // ================================================================
    this.before('DELETE', 'TemplateMaster', async (req) => {
        const template = await SELECT.one.from(TemplateMaster).where({ ID: req.data.ID });
        if (template?.isStandard)
            return req.error(403, 'The Standard Template is a system baseline and cannot be deleted.');
    });

    // ================================================================
    // DOWNLOAD TEMPLATE — exports xlsx, grouped by mapping.sheet
    // (Summary / Detail / Adjustments), in sequenceNo order
    // ================================================================
    this.on('downloadTemplate', async (req) => {
        const { templateID, exportMode } = req.data;

        const template = await SELECT.one.from(TemplateMaster).where({ ID: templateID });
        if (!template) return req.error(404, 'Template not found.');

        const mappings = await SELECT
            .from(TemplateFieldMapping)
            .where({ template_ID: templateID })
            .orderBy('sequenceNo');
        if (!mappings.length) return req.error(404, 'Template has no fields configured.');

        const fieldIds = mappings.map(m => m.field_ID).filter(Boolean);
        const fields = await SELECT.from(FieldMaster).where({ ID: { in: fieldIds } });

        const fieldMap = {};
        fields.forEach(f => { fieldMap[f.ID] = f; });
        mappings.forEach(m => { m.field = fieldMap[m.field_ID] || {}; });
        template.mappings = mappings;

        const oWorkbook = new ExcelJS.Workbook();

        const createStyledSheet = (sheetName, headers) => {
            const oSheet = oWorkbook.addWorksheet(sheetName);
            oSheet.addRow(headers);
            const headerRow = oSheet.getRow(1);
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E6EBF' } };
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top:    { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    left:   { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    right:  { style: 'thin', color: { argb: 'FFFFFFFF' } },
                };
            });
            oSheet.columns = headers.map(h => ({ width: Math.max(h.length + 4, 15) }));
            oSheet.views = [{ state: 'frozen', ySplit: 1 }];
            return oSheet;
        };

        if (exportMode === 'SINGLE') {
            const headers = template.mappings.map(m => m.field?.fieldName).filter(Boolean);
            if (!headers.length) return req.error(404, 'No valid fields found for template.');
            createStyledSheet('Template', headers);

        } else if (exportMode === 'MULTIPLE') {
            const grouped = {};
            const sheetOrder = [];

            template.mappings.forEach(m => {
                const sheet = m.sheet || 'Summary';
                if (!grouped[sheet]) {
                    grouped[sheet] = [];
                    sheetOrder.push(sheet);
                }
                if (m.field?.fieldName) grouped[sheet].push(m.field.fieldName);
            });

            sheetOrder.forEach(sheet => {
                if (grouped[sheet].length) createStyledSheet(sheet, grouped[sheet]);
            });

        } else {
            return req.error(400, `Invalid exportMode: "${exportMode}". Expected "SINGLE" or "MULTIPLE"`);
        }

        const buffer = await oWorkbook.xlsx.writeBuffer();
        req._.res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        req._.res.setHeader('Content-Disposition', `attachment; filename="${template.templateName}_Template.xlsx"`);
        return req._.res.send(buffer);
    });
}); // Closes module.exports