sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "file/temp/lockboxtemppattern/ext/util/Formatter"
], function (Fragment, MessageToast, MessageBox, Filter, FilterOperator, JSONModel, Formatter) {
    "use strict";

    var _oExtensionAPI = null;

    function _getView() {
        return _oExtensionAPI ? _oExtensionAPI.getRouting().getView() : null;
    }

    function _isStandardTemplate(oTemplateCtx) {
        if (!oTemplateCtx) return Promise.resolve(false);
        return oTemplateCtx.requestProperty("isStandard")
            .catch(function (oError) {
                console.error("Could not read isStandard:", oError);
                return true;
            });
    }

    var oHandlers = {

        // ============================================================
        // AUTO MAP STANDARD / AUTO MAP AI
        // ============================================================


        onAutoMapStandard: function () {
            _oExtensionAPI = this;
            var oView = _getView();
            var oTemplateCtx = oView.getBindingContext();
            if (!oTemplateCtx) return;

            _isStandardTemplate(oTemplateCtx).then(function (bIsStandard) {
                if (bIsStandard) {
                    MessageToast.show("Standard templates cannot be modified.");
                    return;
                }

                var sTemplateId = oTemplateCtx.getProperty("ID");

                MessageBox.confirm(
                    "This will overwrite current mappings with the Standard Template (Sheet, Transformation, Target API Field, Semantic Role). Continue?",
                    {
                        title: "Auto Map Standard",
                        onClose: function (sAction) {
                            if (sAction !== MessageBox.Action.OK) return;

                            sap.ui.core.BusyIndicator.show(0);
                            var oActionBinding = oView.getModel().bindContext("/autoMapStandard(...)");
                            oActionBinding.setParameter("targetTemplateId", sTemplateId);

                            oActionBinding.execute()
                                .then(function () {
                                    sap.ui.core.BusyIndicator.hide();
                                    oTemplateCtx.refresh();
                                    MessageToast.show("Standard mappings applied!");
                                })
                                .catch(function (oError) {
                                    sap.ui.core.BusyIndicator.hide();
                                    MessageBox.error(oError.message || "Failed to apply standard mappings.", {
                                        title: "Auto Map Failed"
                                    });
                                });
                        }
                    }
                );
            });
        },

        onAutoMapAI: function () {
            _oExtensionAPI = this;
            var oView = _getView();
            var oTemplateCtx = oView.getBindingContext();
            if (!oTemplateCtx) return;

            _isStandardTemplate(oTemplateCtx).then(function (bIsStandard) {
                if (bIsStandard) {
                    MessageToast.show("Standard templates cannot be modified.");
                    return;
                }

                var sTemplateId    = oTemplateCtx.getProperty("ID");
                var oActionBinding = oView.getModel().bindContext("/autoMapAI(...)");
                oActionBinding.setParameter("templateId", sTemplateId);
                sap.ui.core.BusyIndicator.show(0);

                oActionBinding.execute()
                    .then(function () {
                        sap.ui.core.BusyIndicator.hide();
                        oTemplateCtx.refresh();
                        MessageToast.show("AI mapping complete!");
                    })
                    .catch(function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        MessageBox.error(oError.message || "AI mapping failed.");
                    });
            });
        },


        _findSourceFieldsTable: function (oView) {
            var aTables = oView.findAggregatedObjects(true, function (oControl) {
                return oControl.isA && oControl.isA("sap.m.Table") &&
                       oControl.getId().indexOf("sourceFieldsTable") !== -1;
            });
            return aTables && aTables[0];
        },

        onToggleUnmappedFilter: function (oEvent) {
            _oExtensionAPI = this;
            var oView = _getView();
            var bPressed = oEvent.getParameter("pressed");
            var oTable   = oHandlers._findSourceFieldsTable(oView);
            if (!oTable) return;
            var oBinding = oTable.getBinding("items");
            if (!oBinding) return;

            var aFilters = [];
            if (bPressed) {
                aFilters.push(new Filter("targetApiField_ID", FilterOperator.EQ, null));
            }
            oBinding.filter(aFilters);
        },

        // ============================================================
        // ADD FIELD
        // ============================================================

        onAddMapping: async function () {
            _oExtensionAPI = this;
            var oView = _getView();
            var oTemplateCtx = oView.getBindingContext();

            var bIsStandard = await _isStandardTemplate(oTemplateCtx);
            if (bIsStandard) {
                MessageToast.show("Standard templates cannot be modified.");
                return;
            }

            // NEW: remember sheet mode + reset sheet selector for this dialog session
            var sSheetMode = await oTemplateCtx.requestProperty("sheetMode");
            oHandlers._sCurrentSheetMode = sSheetMode;

            try {
                if (!oHandlers._oAddMappingDialog) {
                    oHandlers._oAddMappingDialog = await Fragment.load({
                        id: oView.getId(),
                        name: "file.temp.lockboxtemppattern.ext.fragment.AddMappingDialog",
                        controller: oHandlers
                    });
                    oView.addDependent(oHandlers._oAddMappingDialog);
                }

                var oSheetSelect = Fragment.byId(oView.getId(), "addMappingSheetSelect");
                if (oSheetSelect) {
                    oSheetSelect.setVisible(sSheetMode === "MULTIPLE");
                    oSheetSelect.setSelectedKey("Summary");
                }

                oHandlers._oAddMappingDialog.open();
            } catch (error) {
                console.error("Fragment Load Error:", error);
                MessageToast.show("Error loading field selection dialog");
            }
        },

        onSearchAddMappingField: function (oEvent) {
            var sValue   = oEvent.getParameter("value");
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter(sValue && sValue.trim()
                ? [new Filter("fieldName", FilterOperator.Contains, sValue)]
                : []);
        },

                // ============================================================
        // ROW-LEVEL DELETE (Source Fields table, single row trash icon)
        // ============================================================
        onDeleteMappingRow: async function (oEvent) {
    _oExtensionAPI = this;

    var oRowCtx = oEvent.getSource().getBindingContext();
    console.log("STEP 2: oRowCtx", oRowCtx);
    if (!oRowCtx) { MessageToast.show("Could not resolve this row."); return; }

    var oTable = oHandlers._findAncestorTable(oEvent.getSource());
    console.log("STEP 3: oTable", oTable);

    var oTemplateCtx = oTable ? oTable.getBindingContext() : _getView().getBindingContext();
    console.log("STEP 4: oTemplateCtx", oTemplateCtx);

    var bIsStandard = await _isStandardTemplate(oTemplateCtx);
    console.log("STEP 5: bIsStandard", bIsStandard);
    if (bIsStandard) {
        MessageToast.show("Standard templates cannot be modified.");
        return;
    }

    var sFieldName = oRowCtx.getProperty("fieldName");
    console.log("STEP 6: about to show confirm dialog for", sFieldName);

    MessageBox.confirm("Remove \"" + sFieldName + "\" from the template?", {
        title: "Confirm Removal",
        onClose: function (sAction) {
            console.log("STEP 7: dialog closed with", sAction);
            if (sAction !== MessageBox.Action.OK) return;

            sap.ui.core.BusyIndicator.show(0);
            oRowCtx.delete("$direct")
                .then(function () {
                    console.log("STEP 8: delete succeeded");
                    sap.ui.core.BusyIndicator.hide();
                    MessageToast.show("Field removed.");
                    if (oTemplateCtx) oTemplateCtx.refresh();
                })
                .catch(function (oError) {
                    console.log("STEP 8: delete FAILED", oError);
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Delete Mapping Row Error:", oError);
                    MessageToast.show("Error removing field.");
                });
        }
    });
},

        onConfirmAddMappingField: function (oEvent) {
    var oSelectedItem = oEvent.getParameter("selectedItem");
    if (!oSelectedItem) return;

    var oFieldCtx    = oSelectedItem.getBindingContext();
    var sFieldId     = oFieldCtx.getProperty("ID");
    var oView        = _getView();
    var oTemplateCtx = oView.getBindingContext();
    if (!oTemplateCtx) return;

    var sTemplateId = oTemplateCtx.getProperty("ID");
    var oModel      = oView.getModel();

    // NEW: pick the sheet from the dialog's selector when in MULTIPLE mode
    var sSheet = "Summary";
    if (oHandlers._sCurrentSheetMode === "MULTIPLE") {
        var oSheetSelect = Fragment.byId(oView.getId(), "addMappingSheetSelect");
        sSheet = (oSheetSelect && oSheetSelect.getSelectedKey()) || "Summary";
    }

    sap.ui.core.BusyIndicator.show(0);

    var oExistingMappingsBinding = oModel.bindList(
        "/TemplateFieldMapping",
        null,
        [],
        [new Filter("template_ID", FilterOperator.EQ, sTemplateId)]
    );

    oExistingMappingsBinding.requestContexts(0, 1000)
        .then(function (aExistingContexts) {
            var iNextSeq = aExistingContexts.length + 1;

            return oModel.bindList("/TemplateFieldMapping")
                .create({
                    template_ID:       sTemplateId,
                    field_ID:          sFieldId,
                    sequenceNo:        iNextSeq,
                    sheet:             sSheet,          // ← was hardcoded "Summary"
                    targetApiField_ID: null,
                    semanticRole:      null,
                    status:            "OK",
                    statusDetail:      null
                }).created();
        })
        .then(function () {
            sap.ui.core.BusyIndicator.hide();
            MessageToast.show("Field added successfully.");
            oTemplateCtx.refresh();
        })
        .catch(function (error) {
            sap.ui.core.BusyIndicator.hide();
            console.error("Add Mapping Error:", error);
            MessageToast.show("Error adding field mapping.");
        });
},

        onCloseAddMappingDialog: function () {
            if (oHandlers._oAddMappingDialog) oHandlers._oAddMappingDialog.close();
        },

        // ============================================================
        // ROW-LEVEL / BULK HELPERS (Source Fields table)
        // ============================================================

        _findAncestorTable: function (oControl) {
            var oCtl = oControl;
            while (oCtl && !(oCtl.isA && oCtl.isA("sap.m.Table"))) {
                oCtl = oCtl.getParent();
            }
            return oCtl;
        },

        // Single delete option for Source Fields: checkbox selection +
        // "Delete Selected" toolbar button. Handles one or many rows.
        onDeleteSelectedFields: async function (oEvent) {
            _oExtensionAPI = this;
            var oView = _getView();
            var oTable = oHandlers._findSourceFieldsTable(oView);
            if (!oTable) { MessageToast.show("Could not find the table."); return; }

            var aSelectedContexts = typeof oTable.getSelectedContexts === "function"
                ? oTable.getSelectedContexts()
                : oTable.getSelectedItems().map(function (oItem) { return oItem.getBindingContext(); });

            if (!aSelectedContexts.length) {
                MessageToast.show("Select at least one field to delete.");
                return;
            }

            var oTemplateCtx = oTable.getBindingContext();

            var bIsStandard = await _isStandardTemplate(oTemplateCtx);
            if (bIsStandard) {
                MessageToast.show("Standard templates cannot be modified.");
                return;
            }

            var sMsg = aSelectedContexts.length === 1
                ? "Remove this field from the template?"
                : "Remove " + aSelectedContexts.length + " fields from the template?";

            MessageBox.confirm(sMsg, {
                title: "Confirm Removal",
                onClose: async function (sAction) {
                    if (sAction !== MessageBox.Action.OK) return;

                    sap.ui.core.BusyIndicator.show(0);
                    try {
                        await Promise.all(aSelectedContexts.map(function (oCtx) {
                            return oCtx.delete("$direct");
                        }));
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show("Field(s) removed.");
                        if (typeof oTable.removeSelections === "function") oTable.removeSelections(true);
                        if (oTemplateCtx) oTemplateCtx.refresh();
                    } catch (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Delete Selected Fields Error:", oError);
                        MessageToast.show("Error removing one or more fields.");
                    }
                }
            });
        },

        // ============================================================
        // MAPPING RULES
        // ============================================================

        onAddRule: async function () {
            _oExtensionAPI = this;
            var oView = _getView();
            var oTemplateCtx = oView.getBindingContext();

            var bIsStandard = await _isStandardTemplate(oTemplateCtx);
            if (bIsStandard) {
                MessageToast.show("Standard templates cannot be modified.");
                return;
            }

            try {
                if (!oHandlers._oCreateRuleDialog) {
                    oHandlers._oCreateRuleDialog = await Fragment.load({
                        id: oView.getId(),
                        name: "file.temp.lockboxtemppattern.ext.fragment.AddRuleDialog",
                        controller: oHandlers
                    });
                    oView.addDependent(oHandlers._oCreateRuleDialog);
                }
                Fragment.byId(oView.getId(), "ruleIdInput").setValue("");
                Fragment.byId(oView.getId(), "ruleNameInput").setValue("");
                oHandlers._oCreateRuleDialog.open();
            } catch (error) {
                console.error("Fragment Load Error:", error);
                MessageToast.show("Error loading rule dialog");
            }
        },

        onCloseCreateRuleDialog: function () {
            if (oHandlers._oCreateRuleDialog) oHandlers._oCreateRuleDialog.close();
        },

        onConfirmCreateRule: async function () {
            var oView = _getView();
            var sRuleId   = Fragment.byId(oView.getId(), "ruleIdInput").getValue().trim();
            var sRuleName = Fragment.byId(oView.getId(), "ruleNameInput").getValue().trim();

            if (!sRuleId)   { MessageToast.show("Please enter a Rule ID");   return; }
            if (!sRuleName) { MessageToast.show("Please enter a Rule Name"); return; }

            var oTemplateCtx = oView.getBindingContext();
            if (!oTemplateCtx) return;
            var sTemplateId = oTemplateCtx.getProperty("ID");
            var oModel = oView.getModel();

            sap.ui.core.BusyIndicator.show(0);

            try {
                var oExistingRulesBinding = oModel.bindList(
                    "/TemplateRule",
                    null,
                    [],
                    [new Filter("template_ID", FilterOperator.EQ, sTemplateId)]
                );
                var aExistingContexts = await oExistingRulesBinding.requestContexts(0, 1000);
                var aExistingIds = aExistingContexts.map(function (oCtx) {
                    return oCtx.getProperty("ID");
                });

                var oNewContext = oModel.bindList("/TemplateRule")
                    .create({
                        template_ID: sTemplateId,
                        ruleId:      sRuleId,
                        ruleName:    sRuleName,
                        sequenceNo:  aExistingIds.length + 1
                    });

                await oNewContext.created();
                var sNewId = oNewContext.getProperty("ID");

                var aOrderedIds = aExistingIds.concat([sNewId]);
                await oHandlers._reorderRules(oModel, oTemplateCtx, aOrderedIds);

                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("Rule \"" + sRuleName + "\" added.");
                oTemplateCtx.refresh();
                oHandlers._oCreateRuleDialog.close();

            } catch (oError) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Add Rule Error:", oError);
                MessageToast.show("Error adding rule: " + (oError.message || "Unknown error"));
            }
        },

        // ============================================================
        // RULE VALUE HELP
        // ============================================================

        onRuleValueHelp: async function () {
    var oView = _getView();

    if (!oHandlers._oRuleVH) {
        oHandlers._oRuleVH = await Fragment.load({
            id: oView.getId(),
            name: "file.temp.lockboxtemppattern.ext.fragment.RuleValueHelp",
            controller: oHandlers
        });
        oView.addDependent(oHandlers._oRuleVH);
    }

    try {
        var oModel = oView.getModel();
        var oOperation = oModel.bindContext("/getAvailableRules(...)");

        await oOperation.execute();

        var oResult = oOperation.getBoundContext().getObject();
        var aRules  = oResult.value || oResult;

        var oJSONModel = new JSONModel({ Rules: aRules });
        oHandlers._oRuleVH.setModel(oJSONModel, "rules");
        oHandlers._oRuleVH.open();

    } catch (oError) {
        console.error("Error fetching rules:", oError);
        MessageBox.error("Unable to fetch rules.");
    }
},

        onSearchRule: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oBinding = oEvent.getSource().getBinding("items");
            if (!oBinding) return;

            oBinding.filter(sValue && sValue.trim()
                ? [new Filter({
                    filters: [
                        new Filter("ruleId", FilterOperator.Contains, sValue),
                        new Filter("ruleName", FilterOperator.Contains, sValue)
                    ],
                    and: false
                })]
                : []);
        },

        onRuleSelected: function (oEvent) {
            var oItem = oEvent.getParameter("selectedItem");
            if (!oItem) return;

            var aCells = oItem.getCells();
            var oView = _getView();

            Fragment.byId(oView.getId(), "ruleIdInput").setValue(aCells[0].getText());
            Fragment.byId(oView.getId(), "ruleNameInput").setValue(aCells[1].getText());
        },

        onRuleCancel: function () {
            // TableSelectDialog closes itself on cancel; nothing else to do.
        },

        // ============================================================
        // MAPPING RULES ROW ACTIONS
        // ============================================================

        _getAllRowContexts: function (oBinding) {
            if (!oBinding) return [];
            if (typeof oBinding.getAllCurrentContexts === "function") {
                return oBinding.getAllCurrentContexts();
            }
            return oBinding.getContexts(0, Infinity);
        },

        _reorderRules: function (oModel, oTemplateCtx, aOrderedIds) {
            var oActionBinding = oModel.bindContext("/reorderRules(...)");
            oActionBinding.setParameter("templateId", oTemplateCtx.getProperty("ID"));
            oActionBinding.setParameter("orderedRuleIds", aOrderedIds);
            return oActionBinding.execute();
        },

        _moveRuleRow: function (oEvent, iDirection) {
            var oTable = oHandlers._findAncestorTable(oEvent.getSource());
            if (!oTable) return;

            var oTemplateCtx = oTable.getBindingContext();

            _isStandardTemplate(oTemplateCtx).then(function (bIsStandard) {
                if (bIsStandard) {
                    MessageToast.show("Standard templates cannot be modified.");
                    return;
                }

                var oRowCtx = oEvent.getSource().getBindingContext();
                if (!oRowCtx) return;

                var oBinding = oTable.getBinding("items");
                if (!oBinding) return;

                var aContexts = oHandlers._getAllRowContexts(oBinding);
                var aRules = aContexts.map(function (oC) {
                    return { ID: oC.getProperty("ID"), sequenceNo: oC.getProperty("sequenceNo") };
                }).sort(function (a, b) { return a.sequenceNo - b.sequenceNo; });

                var sMovedId = oRowCtx.getProperty("ID");
                var iIndex = aRules.findIndex(function (r) { return r.ID === sMovedId; });
                if (iIndex < 0) { MessageToast.show("Could not locate this rule."); return; }

                var iNewIndex = iIndex + iDirection;
                if (iNewIndex < 0 || iNewIndex >= aRules.length) {
                    MessageToast.show("Rule is already at that end.");
                    return;
                }

                var oTemp = aRules[iIndex];
                aRules[iIndex] = aRules[iNewIndex];
                aRules[iNewIndex] = oTemp;

                var aOrderedIds = aRules.map(function (r) { return r.ID; });

                sap.ui.core.BusyIndicator.show(0);
                oHandlers._reorderRules(oTable.getModel(), oTemplateCtx, aOrderedIds)
                    .then(function () {
                        sap.ui.core.BusyIndicator.hide();
                        if (oTemplateCtx) oTemplateCtx.refresh();
                        MessageToast.show("Rule order updated.");
                    })
                    .catch(function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Reorder Rule Error:", oError);
                        MessageToast.show("Error reordering rules.");
                    });
            });
        },

        onMoveRuleUpRow: function (oEvent) {
            oHandlers._moveRuleRow(oEvent, -1);
        },

        onMoveRuleDownRow: function (oEvent) {
            oHandlers._moveRuleRow(oEvent, 1);
        },

        onDeleteRuleRow: function (oEvent) {
            var oTable = oHandlers._findAncestorTable(oEvent.getSource());
            if (!oTable) return;

            var oTemplateCtx = oTable.getBindingContext();

            _isStandardTemplate(oTemplateCtx).then(function (bIsStandard) {
                if (bIsStandard) {
                    MessageToast.show("Standard templates cannot be modified.");
                    return;
                }

                var oRowCtx = oEvent.getSource().getBindingContext();
                if (!oRowCtx) return;

                var sRuleName = oRowCtx.getProperty("ruleName");

                MessageBox.confirm("Delete rule \"" + sRuleName + "\"?", {
                    title: "Confirm Delete",
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.OK) return;

                        sap.ui.core.BusyIndicator.show(0);

                        oRowCtx.delete("$direct")
                            .then(function () {
                                var oBinding = oTable.getBinding("items");
                                var aRemaining = oHandlers._getAllRowContexts(oBinding)
                                    .map(function (oC) {
                                        return { ID: oC.getProperty("ID"), sequenceNo: oC.getProperty("sequenceNo") };
                                    })
                                    .sort(function (a, b) { return a.sequenceNo - b.sequenceNo; });

                                var aOrderedIds = aRemaining.map(function (r) { return r.ID; });

                                return aOrderedIds.length
                                    ? oHandlers._reorderRules(oTable.getModel(), oTemplateCtx, aOrderedIds)
                                    : Promise.resolve();
                            })
                            .then(function () {
                                sap.ui.core.BusyIndicator.hide();
                                if (oTemplateCtx) oTemplateCtx.refresh();
                                MessageToast.show("Rule deleted.");
                            })
                            .catch(function (oError) {
                                sap.ui.core.BusyIndicator.hide();
                                console.error("Delete Rule Error:", oError);
                                MessageToast.show("Error deleting rule.");
                            });
                    }
                });
            });
        }

    };

    window.ObjectPageExt = oHandlers;
    return oHandlers;
});