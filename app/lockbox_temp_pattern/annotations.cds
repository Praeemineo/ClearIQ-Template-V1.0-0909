using TemplateService as service from '../../srv/template-service';

// ================================================================
// TemplateMaster
// ================================================================
annotate service.TemplateMaster with @(
    UI.HeaderInfo : {
        TypeName : 'Template',
        TypeNamePlural : 'Templates',
        Title : {
            $Type : 'UI.DataField',
            Value : templateName,
        },
        Description : {
            $Type : 'UI.DataField',
            Value : templateType,
        },
    },
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'templateName', Value : templateName },
        { $Type : 'UI.DataField', Label : 'templateType', Value : templateType },
        { $Type : 'UI.DataField', Label : 'sheetMode', Value : sheetMode },
        { $Type : 'UI.DataField', Label : 'status', Value : status },
        { $Type : 'UI.DataField', Label : 'isStandard', Value : isStandard },
    ],
);

// ================================================================
// Transformation
// ================================================================
annotate service.Transformation with @(
    UI.HeaderInfo : {
        TypeName : 'Transformation',
        TypeNamePlural : 'Transformations',
        Title : {
            $Type : 'UI.DataField',
            Value : name
        }
    },

    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Name', Value : name },
        { $Type : 'UI.DataField', Label : 'Does', Value : description }
    ],

    UI.FieldGroup #Details : {
        Data : [
            { $Type : 'UI.DataField', Label : 'Name', Value : name },
            { $Type : 'UI.DataField', Label : 'Does', Value : description }
        ]
    },

    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'DetailsFacet',
            Label : 'Transformation Details',
            Target : '@UI.FieldGroup#Details'
        }
    ]
);

// ================================================================
// FileContract
// ================================================================
annotate service.FileContract with @(
  UI: {
    HeaderInfo: {
      TypeName: 'File Contract',
      TypeNamePlural: 'File Contracts',
      Title: { Value: template.templateName },
      Description: { Value: fileType }
    },

    FieldGroup#GeneralInfo: {
      Data: [
        { Value: template_ID, Label: 'Template' },
        { Value: fileType,    Label: 'File Type' }
      ]
    },

    FieldGroup#Structure: {
      Data: [
        { Value: sheetMode,          Label: 'Sheet Mode' },
        { Value: headerRowCount,     Label: 'Header Row' },
        { Value: encoding,           Label: 'Encoding' },
        { Value: dateFormat,         Label: 'Date Format' },
        { Value: decimalSeparator,   Label: 'Decimal Separator' },
        { Value: thousandsSeparator, Label: 'Thousands Separator' },
        { Value: negativeNotation,   Label: 'Negative Notation' },
        { Value: companyCode,        Label: 'Company Code' }
      ]
    },

    FieldGroup#Status: {
      Data: [
        { Value: status,       Label: 'Contract Status' },
        { Value: version,      Label: 'Version' },
        { Value: activatedAt,  Label: 'Active Since' },
        { Value: activatedBy,  Label: 'Activated By' }
      ]
    },

    Facets: [
      { $Type: 'UI.ReferenceFacet', ID: 'GeneralInfoFacet', Label: 'General Information', Target: '@UI.FieldGroup#GeneralInfo' },
      { $Type: 'UI.ReferenceFacet', Label: 'Structure', Target: '@UI.FieldGroup#Structure' },
      { $Type: 'UI.ReferenceFacet', Label: 'Contract Status', Target: '@UI.FieldGroup#Status' },
      { $Type: 'UI.ReferenceFacet', Label: 'Sheet Roles', Target: 'sheetRoles/@UI.LineItem' }
    ],

    LineItem: [
      { Value: template_ID, Label: 'Template' },
      { Value: fileType,    Label: 'File Type' },
      { Value: version,     Label: 'Version' },
      { Value: status,      Label: 'Status', Criticality: statusCriticality },
      { Value: companyCode, Label: 'Company Code' }
    ]
  }
);

annotate service.FileContract with {
  template_ID @Common.Text: template.templateName @Common.TextArrangement: #TextOnly;

  template_ID @(
    Common.ValueListWithFixedValues: false,
    Common.ValueList: {
      CollectionPath: 'TemplateMaster',
      Parameters: [
        {
          $Type: 'Common.ValueListParameterInOut',
          LocalDataProperty: template_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type: 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'templateName'
        },
        {
          $Type: 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'templateType'
        }
      ]
    }
  );
};

// ================================================================
// FileContractSheetRole
// ================================================================
annotate service.FileContractSheetRole with @(
  UI: {
    LineItem: [
      { Value: sequence,      Label: 'Seq' },
      { Value: sheetName,     Label: 'Sheet Name' },
      { Value: role,          Label: 'Role' },
      { Value: keyColumn,     Label: 'Key Column' },
      { Value: rowsExpected,  Label: 'Rows Expected' }
    ],
    HeaderInfo: {
      TypeName: 'Sheet Role',
      TypeNamePlural: 'Sheet Roles',
      Title: { Value: sheetName }
    },
    FieldGroup#Details: {
      Data: [
        { Value: sheetName,    Label: 'Sheet Name' },
        { Value: role,         Label: 'Role' },
        { Value: keyColumn,    Label: 'Key Column' },
        { Value: rowsExpected, Label: 'Rows Expected' },
        { Value: sequence,     Label: 'Sequence' }
      ]
    },
    Facets: [
      { $Type: 'UI.ReferenceFacet', ID: 'SheetRoleDetailsFacet', Label: 'Sheet Role Details', Target: '@UI.FieldGroup#Details' }
    ]
  }
);