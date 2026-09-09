using lockbox.templatebuilder as db from '../db/schema';

@requires: 'ClearIQTemplateAdmin'
service TemplateService {

    @cds.redirection.target
    entity TemplateMaster as projection on db.TemplateMaster;

    entity FieldMaster as projection on db.FieldMaster;

    @odata.draft.enabled
    entity Transformation as projection on db.Transformation;

    // NEW — Target API Field master data
    entity TargetApiField as projection on db.TargetApiField;

    entity TemplateFieldMapping as projection on db.TemplateFieldMapping {
        *,
        field.fieldName           as fieldName          : String,
        field.dataType            as fieldDataType       : String,
        transformation.name       as transformationName  : String,
        targetApiField.apiFieldName as targetApiFieldName : String
    };

    entity TemplateRule as projection on db.TemplateRule;

    @readonly
    entity templateMasterWithCount as projection on db.TemplateMasterWithCount;

    action addFieldsToTemplate(templateId: UUID, fieldIds: many UUID);

    action downloadTemplate(templateID: UUID, exportMode: String) returns LargeBinary;

    action autoMapStandard(targetTemplateId: UUID) returns Boolean;

    action setAsStandard(templateId: UUID) returns Boolean;

    action autoMapAI(templateId: UUID) returns Boolean;

    action reorderRules(templateId: UUID, orderedRuleIds: many UUID) returns Boolean;

    function getAvailableRules() returns many RuleValueHelp;

    type RuleValueHelp {
        ID          : UUID;
        ruleId      : String;
        ruleName    : String;
        description : String;
        actionType  : String;
    }

    @odata.draft.enabled
entity FileContract as projection on db.FileContract {
  *,
  statusCriticality
} actions {
  action activate() returns FileContract;
};
}

// ================================================================
// Value help wiring — field, transformation, targetApiField all
// show name/text instead of raw UUID, and render as dropdowns
// (fixed value lists, since all three master lists are short).
// Sheet & Semantic Role need nothing extra — CDS enums compile to
// native OData enum types and UI5 renders those as dropdowns.
// ================================================================
annotate TemplateService.TemplateFieldMapping with {
    field          @Common.Text: field.fieldName            @Common.TextArrangement: #TextOnly;
    transformation @Common.Text: transformation.name         @Common.TextArrangement: #TextOnly;
    targetApiField @Common.Text: targetApiField.apiFieldName @Common.TextArrangement: #TextOnly;
};