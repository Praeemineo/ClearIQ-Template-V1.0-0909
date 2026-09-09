sap.ui.define([], function () {
    "use strict";

    var oFormatters = {

        // ============================================================
        // TEMPLATE ID DISPLAY
        // ============================================================
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

        // ============================================================
        // CREATED DATE (managed.createdAt)
        // ============================================================
        formatCreatedDate: function (sDate, bIsStandard) {
            if (bIsStandard) return "Built-in";
            if (!sDate) return "";
            var oDate = new Date(sDate);
            var oFormatter = sap.ui.core.format.DateFormat.getInstance({ pattern: "MMM dd, yyyy, hh:mm a" });
            return oFormatter.format(oDate);
        },

        // ============================================================
        // STANDARD TEMPLATE BADGE
        // ============================================================
        formatCustomBadge: function (bIsStandard) {
            return bIsStandard === false || bIsStandard === null;
        },

        // ============================================================
        // SHEET MODE (TemplateMaster.sheetMode — SINGLE / MULTIPLE)
        // ============================================================
        formatSheetModeText: function (sSheetMode) {
            return sSheetMode === "SINGLE" ? "Single sheet" : "Multiple sheets";
        },
        formatSheetModeState: function (sSheetMode) {
            return sSheetMode === "SINGLE" ? "Information" : "Success";
        },

        // ============================================================
        // SHEET (TemplateFieldMapping.sheet enum — Summary/Detail/Adjustments)
        // ============================================================
        formatSheetState: function (sSheet) {
            var oMap = { "Summary": "Information", "Detail": "Success", "Adjustments": "Warning" };
            return oMap[sSheet] || "None";
        },
        formatSheetText: function (sSheet) {
            return sSheet || "Summary";
        },

        // ============================================================
        // DATA TYPE (FieldMaster.dataType — Text/Date/Number/Decimal/Boolean)
        // Used by: HeaderMetadataSection / SourceFieldsSection (path: 'dataType' / 'fieldDataType')
        // ============================================================
        formatDataTypeState: function (sDataType) {
            var oMap = { "Text": "None", "Date": "Information", "Number": "Success", "Decimal": "Success", "Boolean": "Warning" };
            return oMap[sDataType] || "None";
        },
        formatDataTypeText: function (sDataType) {
            return sDataType || "Text";
        },

        // ============================================================
        // DATA TYPE — alias used by CreateTemplateDialog field-picker tables
        // (FieldMaster.dataType, same enum as above, kept as separate names
        // to match the existing fragment bindings '.formatTypeText'/'.formatTypeState')
        // ============================================================
        formatTypeText: function (sDataType) {
            return sDataType || "Text";
        },
        formatTypeState: function (sDataType) {
            var oMap = { "Text": "None", "Date": "Information", "Number": "Success", "Decimal": "Success", "Boolean": "Warning" };
            return oMap[sDataType] || "None";
        },

        // ============================================================
        // PROPERTY / REQUIRED FLAG (FieldMaster.isRequired boolean)
        // Used by: CreateTemplateDialog field-picker tables
        // ============================================================
        formatPropertyText: function (bIsRequired) {
            return bIsRequired ? "Required" : "Optional";
        },
        formatPropertyState: function (bIsRequired) {
            return bIsRequired ? "Warning" : "None";
        },

        // ============================================================
        // SEMANTIC ROLE (TemplateFieldMapping.semanticRole enum)
        // AMOUNT / DATE / REFERENCE / PARTY / CODE / TEXT
        // ============================================================
        formatSemanticRoleState: function (sRole) {
            var oMap = {
                "AMOUNT":    "Success",
                "DATE":      "Information",
                "REFERENCE": "None",
                "PARTY":     "Warning",
                "CODE":      "Error",
                "TEXT":      "None"
            };
            return oMap[sRole] || "None";
        },
        formatSemanticRoleText: function (sRole) {
            return sRole || "";
        },

        // ============================================================
        // MAPPING STATUS (TemplateFieldMapping.status enum — OK/WARNING/ERROR)
        // ============================================================
        formatStatusState: function (sStatus) {
            var oMap = { "OK": "Success", "WARNING": "Warning", "ERROR": "Error" };
            return oMap[sStatus] || "None";
        },
        formatStatusText: function (sStatus) {
            return sStatus || "OK";
        },
        formatStatusIcon: function (sStatus) {
            var oMap = {
                "OK":      "sap-icon://sys-enter-2",
                "WARNING": "sap-icon://alert",
                "ERROR":   "sap-icon://error"
            };
            return oMap[sStatus] || "sap-icon://sys-enter-2";
        },

        // ============================================================
        // TRANSFORMATION (TemplateFieldMapping.transformation → name)
        // ============================================================
        formatTransformationText: function (sName) {
            return sName || "—";
        },

        // ============================================================
        // MAPPED FRACTION — header progress indicator
        // ============================================================
        formatMappedFraction: function (iMappedCount, iTotalCount) {
            return (iMappedCount || 0) + " / " + (iTotalCount || 0) + " mapped";
        },
        formatMappedPercent: function (iMappedCount, iTotalCount) {
            if (!iTotalCount) return 0;
            return Math.round((iMappedCount / iTotalCount) * 100);
        }
    };

    return oFormatters;
});