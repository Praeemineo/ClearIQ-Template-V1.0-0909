namespace lockbox.templatebuilder;

using {
    cuid,
    managed
} from '@sap/cds/common';

// ================================================================
// Fixed enums
// ================================================================
type SheetType : String(20) enum {
    Summary;
    Detail;
    Adjustments;
};

type SemanticRoleType : String(20) enum {
    AMOUNT;
    DATE;
    REFERENCE;
    PARTY;
    CODE;
    TEXT;
};

type MappingStatus : String(20) enum {
    OK;
    WARNING;
    ERROR;
};

// ================================================================
// TemplateMaster
// ================================================================
entity TemplateMaster : cuid, managed {
    templateName          : String(100);
    templateType          : String(50);
    sheetMode             : String(20);
    status                : String(20);
    isStandard            : Boolean default false;
    virtual mappingsCount : Integer;
    mappings              : Composition of many TemplateFieldMapping
                                 on mappings.template = $self;
    rules                 : Composition of many TemplateRule
                                 on rules.template = $self;
}

// ================================================================
// FieldMaster — source field catalog
// ================================================================
entity FieldMaster : cuid {
    fieldName   : String(100);
    dataType    : String(20);
    isStandard  : Boolean default true;
    isRequired  : Boolean default false;
    isCustom    : Boolean default false;
}

// ================================================================
// Transformation — reusable library, admin-managed master data
// ================================================================
entity Transformation : cuid {
    name               : String(50);
    description        : String(200);
}

// ================================================================
// TargetApiField — NEW. Master list of SAP API fields a source
// field can be mapped to. Admin-managed, extensible over time
// (e.g. adding new S/4HANA API fields as the integration grows).
// ================================================================
entity TargetApiField : cuid {
    apiFieldName        : String(100);   // e.g. PaymentReference, CompanyCode
    description         : String(200);   // e.g. "Payment reference number on the clearing doc"
    virtual usageCount  : Integer;
}

// ================================================================
// TemplateFieldMapping — the Object Page table
// Columns: Source Field | Sheet | Data Type | Transformation |
//          Target API Field | Semantic Role | Status | Status Detail
// ================================================================
entity TemplateFieldMapping : cuid {
    template       : Association to TemplateMaster;
    field          : Association to FieldMaster;
    sheet          : SheetType default 'Summary';
    transformation : Association to Transformation;
    targetApiField : Association to TargetApiField;   // was String(100), now a managed dropdown
    semanticRole   : SemanticRoleType;
    status         : MappingStatus default 'OK';
    statusDetail   : String(200);
    sequenceNo     : Integer;
}

// ================================================================
// TemplateRule
// ================================================================
entity TemplateRule : cuid {
    template   : Association to TemplateMaster;
    ruleId     : String(50);
    ruleName   : String(100);
    sequenceNo : Integer;
}

view TemplateMasterWithCount as
    select from TemplateMaster {
        *,
        (
            select count(*) from TemplateFieldMapping
            where TemplateFieldMapping.template.ID = TemplateMaster.ID
        ) as mappingsCount : Integer
    };


// Add alongside your existing SheetType / SemanticRoleType / MappingStatus
type FileTypeEnum : String(20) enum {
    CSVSingleSheet; ExcelMultiSheet; PDFRemittance; BAI2MT940CAMT; EDI820;
};
type ContractStatusEnum : String(20) enum {
    Draft; Active; Superseded; Deprecated;
};
type SheetRoleType : String(20) enum {
    Header; Detail; Adjustments; Ignored;
};

entity FileContract : cuid, managed {
  template            : Association to TemplateMaster;
  fileType            : FileTypeEnum;
  version             : Integer;
  status              : ContractStatusEnum default 'Draft';

  sheetMode           : String(20);
  headerRowCount      : Integer;
  encoding            : String(20);
  dateFormat          : String(20);
  decimalSeparator    : String(1);
  thousandsSeparator  : String(1);
  negativeNotation    : String(20);
  companyCode         : String(10);

  virtual statusCriticality : Integer;

  activatedAt         : Timestamp;
  activatedBy         : String(80);

  sheetRoles          : Composition of many FileContractSheetRole on sheetRoles.contract = $self;
}

entity FileContractSheetRole : cuid {
  contract      : Association to FileContract;
  sheetName     : String(60);
  role          : SheetRoleType;
  keyColumn     : String(60);
  rowsExpected  : String(20);
  sequence      : Integer;
}