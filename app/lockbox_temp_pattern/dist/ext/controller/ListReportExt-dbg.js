sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/util/File",
    "sap/m/MessageBox"
], function (Fragment, MessageToast, JSONModel, Filter, FilterOperator, File, MessageBox) {
    "use strict";

    var _oExtensionAPI = null;

    function _getView() {
        return _oExtensionAPI ? _oExtensionAPI.getRouting().getView() : null;
    }

    var oHandlers = {

        // ============================================================
        // FORMATTERS (local copies; canonical versions in ext/util/Formatter.js)
        // ============================================================

        formatCreatedDate: function (sDate, bIsStandard) {
            if (bIsStandard) return "Built-in";
            if (!sDate) return "";
            var oDate = new Date(sDate);
            var oFormatter = sap.ui.core.format.DateFormat.getInstance({ pattern: "MMM dd, yyyy, hh:mm a" });
            return oFormatter.format(oDate);
        },

        formatTemplateID: function (sUUID, sTemplateType) {
            if (!sUUID) return "";
            var sHexPart = sUUID.substring(sUUID.length - 6).toUpperCase();
            var sSuffix = "TEMPLATE";
            if (sTemplateType) {
                var sTypeUpper = sTemplateType.toUpperCase();
                if (sTypeUpper === "LOCKBOX")              sSuffix = "LBX";
                else if (sTypeUpper.includes("PAYMENT"))   sSuffix = "PAY";
                else if (sTypeUpper.includes("CLEARING"))  sSuffix = "CLR";
            }
            return sSuffix + "-" + sTemplateType + "-V1-" + sHexPart;
        },

        formatCustomBadge: function (bIsStandard) {
            return bIsStandard === false || bIsStandard === null;
        },

        formatTypeState: function (sDataType) {
            var oMap = { "Text": "None", "Date": "Information", "Number": "Success", "Decimal": "Success", "Boolean": "Warning" };
            return oMap[sDataType] || "None";
        },
        formatTypeText: function (sDataType) {
            return sDataType || "Text";
        },

        formatPropertyText: function (bIsRequired) {
            return (bIsRequired === true || bIsRequired === "Yes") ? "Required" : "Optional";
        },
        formatPropertyState: function (bIsRequired) {
            return (bIsRequired === true || bIsRequired === "Yes") ? "Error" : "None";
        },

        // ============================================================
        // CREATE TEMPLATE DIALOG
        // ============================================================

        onCreateTemplate: async function () {
            _oExtensionAPI = this;
            var oView = _getView();
            try {
                if (!oHandlers._oCreateDialog) {
                    oHandlers._oCreateDialog = await Fragment.load({
                        id: oView.getId(),
                        name: "file.temp.lockboxtemppattern.ext.fragment.CreateTemplateDialog",
                        controller: oHandlers
                    });
                    oView.addDependent(oHandlers._oCreateDialog);
                }
                oHandlers._resetDialogFields();
                oHandlers._oCreateDialog.open();
            } catch (error) {
                console.error("Fragment Load Error:", error);
                MessageToast.show("Error loading dialog");
            }
        },

        _resetDialogFields: function () {
            var oView = _getView();
            Fragment.byId(oView.getId(), "templateTypeSelect").setSelectedKey("LOCKBOX");
            Fragment.byId(oView.getId(), "sheetModeSelect").setSelectedKey("SINGLE");

            var oStdTable = Fragment.byId(oView.getId(), "fieldsTable");
            var oUdfTable = Fragment.byId(oView.getId(), "udfTable");
            if (oStdTable) oStdTable.removeSelections(true);
            if (oUdfTable) oUdfTable.removeSelections(true);

            if (!oView.getModel("counterModel")) {
                oView.setModel(new JSONModel({ selectedCount: 0 }), "counterModel");
            } else {
                oView.getModel("counterModel").setProperty("/selectedCount", 0);
            }

            oView.setModel(new JSONModel({
                SelectedFields: [],
                UdfUploadPreview: [],
                isMultiSheetMode: false,
                showUdfUploadPanel: false,
                templateNameValueState: "None"
            }), "create");
        },

        onCloseDialog: function () {
            if (oHandlers._oCreateDialog) oHandlers._oCreateDialog.close();
        },

        // ============================================================
        // FIELD SELECTION
        // ============================================================

        onFieldSelectionChange: function (oEvent) {
            var bIsUdfTable = oEvent.getSource().getId().indexOf("udfTable") !== -1;
            var aChanged = oEvent.getParameter("listItems") || [oEvent.getParameter("listItem")];
            aChanged.forEach(function (oItem) {
                if (!oItem) return;
                var oCtx = oItem.getBindingContext();
                if (!oCtx) return;
                var oFieldData = {
                    ID: oCtx.getProperty("ID"),
                    fieldName: oCtx.getProperty("fieldName"),
                    dataType: oCtx.getProperty("dataType"),
                    isCustom: bIsUdfTable
                };
                if (oItem.getSelected()) {
                    oHandlers._addToSelectedFields(oFieldData);
                } else {
                    oHandlers._removeFromSelectedFields(oFieldData.ID);
                }
            }.bind(oHandlers));
        },

        _addToSelectedFields: function (oField) {
            var oModel = _getView().getModel("create");
            var aSelected = oModel.getProperty("/SelectedFields");
            if (aSelected.some(function (f) { return f.ID === oField.ID; })) return;
            aSelected.push({
                ID: oField.ID,
                fieldName: oField.fieldName,
                dataType: oField.dataType,
                isCustom: oField.isCustom,
                sheet: "Summary",
                sequenceNo: aSelected.length + 1
            });
            oModel.setProperty("/SelectedFields", aSelected);
        },

        _removeFromSelectedFields: function (sID) {
            var oModel = _getView().getModel("create");
            var aSelected = oModel.getProperty("/SelectedFields").filter(function (f) { return f.ID !== sID; });
            oHandlers._resequence(aSelected);
        },

        _resequence: function (aFields) {
            aFields.forEach(function (f, i) { f.sequenceNo = i + 1; });
            _getView().getModel("create").setProperty("/SelectedFields", aFields);
        },

        onMoveFieldUp: function (oEvent) {
            var oModel = _getView().getModel("create");
            var aFields = oModel.getProperty("/SelectedFields");
            var iIndex = parseInt(oEvent.getSource().getBindingContext("create").getPath().split("/").pop(), 10);
            if (iIndex > 0) {
                var t = aFields[iIndex - 1]; aFields[iIndex - 1] = aFields[iIndex]; aFields[iIndex] = t;
                oHandlers._resequence(aFields);
            }
        },

        onMoveFieldDown: function (oEvent) {
            var oModel = _getView().getModel("create");
            var aFields = oModel.getProperty("/SelectedFields");
            var iIndex = parseInt(oEvent.getSource().getBindingContext("create").getPath().split("/").pop(), 10);
            if (iIndex < aFields.length - 1) {
                var t = aFields[iIndex + 1]; aFields[iIndex + 1] = aFields[iIndex]; aFields[iIndex] = t;
                oHandlers._resequence(aFields);
            }
        },

        onRemoveSelectedField: function (oEvent) {
            var oView = _getView();
            var oCtx = oEvent.getSource().getBindingContext("create");
            var sID = oCtx.getProperty("ID");
            oHandlers._removeFromSelectedFields(sID);

            ["fieldsTable", "udfTable"].forEach(function (sTableId) {
                var oTable = Fragment.byId(oView.getId(), sTableId);
                if (!oTable) return;
                oTable.getItems().forEach(function (oItem) {
                    var c = oItem.getBindingContext();
                    if (c && c.getProperty("ID") === sID) oItem.setSelected(false);
                });
            });
        },

        // ============================================================
        // TYPE FILTER
        // ============================================================

        onTypeFilterChange: function (oEvent) {
            var sKey = oEvent.getSource().getSelectedKey();
            var oTable = Fragment.byId(_getView().getId(), "fieldsTable");
            if (!oTable) return;
            var oBinding = oTable.getBinding("items");
            if (!oBinding) return;
            oBinding.filter(sKey !== "ALL" ? [new Filter("dataType", FilterOperator.EQ, sKey)] : []);
        },

        // ============================================================
        // SHEET MODE
        // ============================================================

        onSheetModeChange: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            _getView().getModel("create").setProperty("/isMultiSheetMode", sKey === "MULTIPLE");
        },

        onFieldSheetChange: function (oEvent) {
            var sSheetKey = oEvent.getSource().getSelectedKey();
            var oCtx = oEvent.getSource().getBindingContext("create");
            oCtx.getModel().setProperty(oCtx.getPath() + "/sheet", sSheetKey);
        },

        // ============================================================
        // ADD NEW FIELD
        // ============================================================

        onAddNewField: async function () {
            var oView = _getView();
            try {
                if (!oHandlers._oAddFieldDialog) {
                    oHandlers._oAddFieldDialog = await Fragment.load({
                        id: oView.getId(),
                        name: "file.temp.lockboxtemppattern.ext.fragment.AddFieldDialog",
                        controller: oHandlers
                    });
                    oView.addDependent(oHandlers._oAddFieldDialog);
                }
                oHandlers._resetAddFieldFields();
                oHandlers._oAddFieldDialog.open();
            } catch (error) {
                console.error("Fragment Load Error:", error);
                MessageToast.show("Error loading add field dialog");
            }
        },

        _resetAddFieldFields: function () {
            var oView = _getView();
            Fragment.byId(oView.getId(), "newFieldNameInput").setValue("");
            Fragment.byId(oView.getId(), "newTypeSelect").setSelectedKey("Text");
            Fragment.byId(oView.getId(), "newPropertySelect").setSelectedKey("OPTIONAL");
        },

        onCloseAddFieldDialog: function () {
            if (oHandlers._oAddFieldDialog) oHandlers._oAddFieldDialog.close();
        },

        onSaveNewField: function () {
            var oView = _getView();
            try {
                var sFieldName = Fragment.byId(oView.getId(), "newFieldNameInput").getValue();
                var sDataType  = Fragment.byId(oView.getId(), "newTypeSelect").getSelectedKey();
                var sProperty  = Fragment.byId(oView.getId(), "newPropertySelect").getSelectedKey();

                if (!sFieldName || !sFieldName.trim()) { MessageToast.show("Please enter a field name"); return; }

                var oListBinding = oView.getModel().bindList("/FieldMaster");
                sap.ui.core.BusyIndicator.show(0);

                var oNewContext = oListBinding.create({
                    fieldName:  sFieldName,
                    dataType:   sDataType,
                    isStandard: false,
                    isRequired: sProperty === "REQUIRED",
                    isCustom:   true
                });

                oNewContext.created()
                    .then(function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show("Field added.");

                        oHandlers._addToSelectedFields({
                            ID: oNewContext.getProperty("ID"),
                            fieldName: sFieldName,
                            dataType: sDataType,
                            isCustom: true
                        });

                        var oTable = Fragment.byId(oView.getId(), "udfTable");
                        if (oTable && oTable.getBinding("items")) oTable.getBinding("items").refresh();
                        oHandlers.onCloseAddFieldDialog();
                    }.bind(oHandlers))
                    .catch(function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Save Field Error:", oError);
                        MessageToast.show("Error adding field.");
                    });

            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Save Field Execution Error:", error);
                MessageToast.show("Error saving field");
            }
        },

        onDeleteUdfField: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext();
            if (!oCtx) return;

            var sFieldName = oCtx.getProperty("fieldName");
            var sID = oCtx.getProperty("ID");

            MessageBox.confirm("Delete custom field \"" + sFieldName + "\"? This cannot be undone.", {
                title: "Confirm Delete",
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) return;

                    sap.ui.core.BusyIndicator.show(0);
                    oCtx.delete("$direct")
                        .then(function () {
                            sap.ui.core.BusyIndicator.hide();
                            MessageToast.show("Field deleted.");
                            oHandlers._removeFromSelectedFields(sID);
                        }.bind(oHandlers))
                        .catch(function (oError) {
                            sap.ui.core.BusyIndicator.hide();
                            console.error("Delete Custom Field Error:", oError);
                            MessageToast.show("Error deleting field.");
                        });
                }.bind(oHandlers)
            });
        },

        // ============================================================
        // CUSTOM FIELD BULK UPLOAD
        // ============================================================

        onOpenUdfUploadPanel: function () {
            var oModel = _getView().getModel("create");
            oModel.setProperty("/showUdfUploadPanel", !oModel.getProperty("/showUdfUploadPanel"));
        },

        onDownloadUdfTemplate: function () {
            // TODO: point at a static blank .xlsx bundled with the app
        },

        onUdfFileSelected: function (oEvent) {
            var oFile = oEvent.getParameter("files") && oEvent.getParameter("files")[0];
            if (!oFile) return;

            var oReader = new FileReader();
            oReader.onload = function (e) {
                // eslint-disable-next-line no-undef
                var oWorkbook = XLSX.read(e.target.result, { type: "array" });
                var oSheet = oWorkbook.Sheets[oWorkbook.SheetNames[0]];
                // eslint-disable-next-line no-undef
                var aRows = XLSX.utils.sheet_to_json(oSheet);

                var aPreview = aRows.map(function (r) {
                    return {
                        fieldName: r["Field Name"],
                        dataType: (r["Type"] || "Text"),
                        isRequired: /^(y|yes|true|required)$/i.test(String(r["Required"] || "")),
                        include: true
                    };
                });

                _getView().getModel("create").setProperty("/UdfUploadPreview", aPreview);
            }.bind(oHandlers);
            oReader.readAsArrayBuffer(oFile);
        },

        onImportUdfFields: async function () {
            var oView = _getView();
            var oModel = oView.getModel("create");
            var aIncluded = oModel.getProperty("/UdfUploadPreview").filter(function (r) { return r.include; });
            if (!aIncluded.length) { MessageToast.show("Select at least one field to import."); return; }

            sap.ui.core.BusyIndicator.show(0);
            var oListBinding = oView.getModel().bindList("/FieldMaster");

            try {
                for (const r of aIncluded) {
                    if (!r.fieldName) continue;
                    const oNewContext = oListBinding.create({
                        fieldName: r.fieldName,
                        dataType: r.dataType,
                        isStandard: false,
                        isRequired: r.isRequired,
                        isCustom: true
                    });
                    await oNewContext.created();

                    oHandlers._addToSelectedFields({
                        ID: oNewContext.getProperty("ID"),
                        fieldName: r.fieldName,
                        dataType: r.dataType,
                        isCustom: true
                    });
                }
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show(aIncluded.length + " field(s) imported.");

                var oTable = Fragment.byId(oView.getId(), "udfTable");
                if (oTable && oTable.getBinding("items")) oTable.getBinding("items").refresh();

                oModel.setProperty("/UdfUploadPreview", []);
                oModel.setProperty("/showUdfUploadPanel", false);
            } catch (oError) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Bulk custom-field import error:", oError);
                MessageToast.show("Error importing one or more fields.");
            }
        },

        // ============================================================
        // SAVE: TEMPLATE NAME POPUP, THEN CREATE + DOWNLOAD
        // ============================================================

        onOpenSaveTemplateDialog: async function () {
            var oView = _getView();
            var aSelected = oView.getModel("create").getProperty("/SelectedFields");
            if (!aSelected.length) {
                MessageToast.show("Please select at least one field");
                return;
            }
            if (!oHandlers._oSaveNameDialog) {
                oHandlers._oSaveNameDialog = await Fragment.load({
                    id: oView.getId(),
                    name: "file.temp.lockboxtemppattern.ext.fragment.SaveTemplateName",
                    controller: oHandlers
                });
                oView.addDependent(oHandlers._oSaveNameDialog);
            }
            Fragment.byId(oView.getId(), "templateNameInput").setValue("");
            oView.getModel("create").setProperty("/templateNameValueState", "None");
            oHandlers._oSaveNameDialog.open();
        },

        onTemplateNameLiveChange: function (oEvent) {
            var sValue = oEvent.getParameter("value").trim();
            _getView().getModel("create").setProperty("/templateNameValueState", sValue ? "None" : "Error");
        },

        onCancelSaveTemplateDialog: function () {
            if (oHandlers._oSaveNameDialog) oHandlers._oSaveNameDialog.close();
        },

        onManageTransformations: function () {
    _oExtensionAPI = this;
    var oView = _getView();

    this.getRouting().navigateToRoute("TransformationList");

    setTimeout(function () {
        var oModel = oView && oView.getModel();
        if (oModel) {
            oModel.refresh();
        }
    }, 500);
},
        onManageFileContracts: function () {
    _oExtensionAPI = this;
    var oView = _getView();

    this.getRouting().navigateToRoute("FileContractList");

    setTimeout(function () {
        var oModel = oView && oView.getModel();
        if (oModel) {
            oModel.refresh();
        }
    }, 500);
},
        onConfirmSaveTemplate: function () {
            var oView = _getView();
            try {
                var sTemplateName = Fragment.byId(oView.getId(), "templateNameInput").getValue().trim();
                if (!sTemplateName) {
                    oView.getModel("create").setProperty("/templateNameValueState", "Error");
                    return;
                }

                var sTemplateType   = Fragment.byId(oView.getId(), "templateTypeSelect").getSelectedKey();
                var sSheetMode      = Fragment.byId(oView.getId(), "sheetModeSelect").getSelectedKey();
                var aSelectedFields = oView.getModel("create").getProperty("/SelectedFields");

                var oTemplatePayload = {
                    templateName: sTemplateName,
                    templateType: sTemplateType,
                    sheetMode:    sSheetMode,
                    status:       "ACTIVE",
                    isStandard:   false,
                    mappings: aSelectedFields.map(function (oField, i) {
                        return {
                            field_ID:          oField.ID,
                            sequenceNo:        i + 1,
                            sheet:             sSheetMode === "MULTIPLE" ? (oField.sheet || "Summary") : "Summary",
                            targetApiField_ID: null,
                            semanticRole:      null,
                            status:            "OK"
                        };
                    })
                };

                var oListBinding = oView.getModel().bindList("/TemplateMaster");
                sap.ui.core.BusyIndicator.show(0);

                var oNewContext = oListBinding.create(oTemplatePayload);

                oNewContext.created()
                    .then(function () {
                        MessageToast.show("Template created. Preparing download…");

                        oHandlers._oSaveNameDialog.close();
                        oHandlers.onCloseDialog();

                        oHandlers._refreshListReport();

                        var sNewId = oNewContext.getProperty("ID");
                        var sSavedTemplateName = oNewContext.getProperty("templateName") || sTemplateName;
                        return oHandlers._downloadTemplateFile(sNewId, sSheetMode, sSavedTemplateName);
                    }.bind(oHandlers))
                    .then(function () {
                        sap.ui.core.BusyIndicator.hide();
                    })
                    .catch(function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Save Error:", oError);
                        MessageBox.error("Error creating template.");
                    });

            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Save Execution Error:", error);
                MessageToast.show("Error saving template");
            }
        },

        _getListReportTable: function () {
            var oView = _getView();
            var aTables = oView.findAggregatedObjects(true, function (oControl) {
                return oControl.isA && oControl.isA("sap.ui.mdc.Table");
            });
            return aTables && aTables[0];
        },

        _refreshListReport: function () {
            if (_oExtensionAPI && typeof _oExtensionAPI.refresh === "function") {
                _oExtensionAPI.refresh();
                return;
            }
            var oTable = oHandlers._getListReportTable();
            if (!oTable) return;
            var oBinding = oTable.getBinding("items") || oTable.getBinding("rows");
            if (oBinding) oBinding.refresh();
        },

        // ============================================================
        // DOWNLOAD EXCEL
        // ============================================================

        onDownloadExcel: async function (oCurrentContext, aSelectedContexts) {
            _oExtensionAPI = this;

            var oContext = Array.isArray(aSelectedContexts) && aSelectedContexts.length
                ? aSelectedContexts[0]
                : oCurrentContext;
            if (!oContext) { MessageToast.show("Select a template to download."); return; }

            try {
                await oContext.requestProperty(["isStandard", "sheetMode"]);
            } catch (oError) {
                console.error("requestProperty failed:", oError);
                MessageToast.show("Could not load template details.");
                return;
            }

            if (oContext.getProperty("isStandard")) {
                MessageBox.information("The Standard Template cannot be exported. Create a custom template first.");
                return;
            }

            var sTemplateId   = oContext.getProperty("ID");
            var sSheetMode    = oContext.getProperty("sheetMode");
            var sTemplateName = oContext.getProperty("templateName");

            if (!sTemplateId) { MessageToast.show("Could not resolve template ID."); return; }
            if (!sSheetMode)  { MessageToast.show("Could not resolve sheet mode for this template."); return; }

            oHandlers._downloadTemplateFile(sTemplateId, sSheetMode, sTemplateName);
        },

        _downloadTemplateFile: function (sTemplateId, sSheetMode, sTemplateName) {
            var sServiceUrl = _getView().getModel().getServiceUrl();
            sap.ui.core.BusyIndicator.show(0);

            return fetch(sServiceUrl + "downloadTemplate", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Csrf-Token": "unsafe-disabled" },
                credentials: "include",
                body: JSON.stringify({ templateID: sTemplateId, exportMode: sSheetMode })
            })
                .then(function (res) {
                    if (!res.ok) return res.text().then(function (t) { throw new Error("HTTP " + res.status + ": " + t); });
                    return res.blob();
                })
                .then(function (blob) {
                    sap.ui.core.BusyIndicator.hide();
                    File.save(
                        blob,
                        sTemplateName,
                        "xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    );
                })
                .catch(function (error) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageToast.show("Download error: " + error.message);
                });
        },

        // ============================================================
        // DELETE TEMPLATE
        // ============================================================

        onDeleteTemplate: function (oContext) {
            if (!oContext) { MessageToast.show("Could not resolve binding context."); return; }
            if (oContext.getProperty("isStandard")) {
                MessageBox.error("The Standard Template is a system baseline and cannot be deleted.");
                return;
            }
            var sTemplateId = oContext.getProperty("ID");
            if (!sTemplateId) { MessageToast.show("Could not resolve template ID."); return; }

            MessageBox.confirm("Are you sure you want to permanently delete this template?", {
                title: "Confirm Deletion",
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) return;
                    sap.ui.core.BusyIndicator.show(0);

                    oContext.delete("$direct")
                        .then(function () {
                            sap.ui.core.BusyIndicator.hide();
                            MessageToast.show("Template deleted successfully.");
                            oHandlers._refreshListReport();
                        }.bind(oHandlers))
                        .catch(function (oError) {
                            sap.ui.core.BusyIndicator.hide();
                            var sMsg = oError.message || "Unknown error";
                            if (sMsg.includes("403") || sMsg.includes("baseline") || sMsg.includes("Standard")) {
                                MessageBox.error("This template is protected and cannot be deleted.");
                            } else {
                                MessageBox.error("Delete failed: " + sMsg);
                            }
                        }.bind(oHandlers));
                }.bind(oHandlers)
            });
        }

    };

    return oHandlers;
});