Package.describe({
	name: 'gravitum:file-collection',
	summary: "A lightweigh package which simplifies file upload and organisation. Creates new collection type for files.",
	version: "1.0.0"
});

Package.onUse(function (api, where) {
	api.versionsFrom("1.0");
	api.use("templating", "client");
	api.use("reactive-var","client")
	api.use("underscore")

	//api.use("meteorhacks:async@1.0.0");
	api.addFiles("filecollection.html","client");
	api.addFiles("client.js","client");
	api.addFiles("server.js","server");
	api.export('FileCollection');
});