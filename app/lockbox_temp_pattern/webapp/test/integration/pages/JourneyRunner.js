sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"file/temp/lockboxtemppattern/test/integration/pages/TemplateMasterList.gen",
	"file/temp/lockboxtemppattern/test/integration/pages/TemplateMasterObjectPage.gen"
], function (JourneyRunner, TemplateMasterListGenerated, TemplateMasterObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('file/temp/lockboxtemppattern') + '/test/flp.html#app-preview',
        pages: {
			onTheTemplateMasterListGenerated: TemplateMasterListGenerated,
			onTheTemplateMasterObjectPageGenerated: TemplateMasterObjectPageGenerated
        },
        async: true
    });

    return runner;
});

