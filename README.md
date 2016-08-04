gravitum:file-collection
=========================


A lightweigh package which simplifies file upload and organisation. Creates new collection type for files. Implements default meteor collection. Supports amazon s3.

## Usage

### server

Configure file storage

`FileCollection.defaults({aws:{
  bucket:bucket,
  accessKey:accessKey,
  secretKey:secretKey,
  dns:!!dnsrerouting
}})`


Then , Treat the same way as regular meteor collection

`
var allow = {};
allow.insert = allow.update = allow.remove = function(){return true}

Images = new FileCollection("images");

TablesImages.allow(simpleAllow);
`

add some hooks if required

`Images = new FileCollection("images",{aws:_.extend(FileCollection.defaults().aws,{convert:function(obj, buffer, cb){
  console.log("runing convert")
  gm(buffer,obj.file.name).resize(320,240,"^").gravity("Center")
  .crop(320,240,0,0)
  .toBuffer("JPG",function (err, buffer) {
    cb(err,buffer)
  })
}})} )`




### client

TO Document. Currently, sample usage can be found in https://github.com/gravitum/meteor-autoform-filepicker.

{{>UploadFileButton context}}
collection : Collection - required
multiple:bool
accept:string
class
title
onInserted:function
onInsert:function
