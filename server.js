var AWS=Meteor.AWS;
var Fiber = Npm.require('fibers');
var defaultOptions={aws:{}}
FileCollection = function FileCollection (name,opt) {
	var options=_.isObject(opt)?_.clone(opt):{}
	var daws=_.isObject(defaultOptions.aws)?_.clone(defaultOptions.aws):{};
	options.aws=_.isObject(options.aws)?_.clone(options.aws):daws;
	if((!_.isObject(options))||(!_.isObject(options.aws))||(typeof options.aws.bucket!="string")||(typeof options.aws.accessKey!="string")||(typeof options.aws.secretKey!="string")){
		this.isReady=false;
		throw new Meteor.Error("FileCollection constructor","wrong options");
		return;
	}
	var awsOptions=_.clone(options.aws);
	var args=_.toArray(arguments);
	if(_.isObject(args[1]))delete args[1].aws;
	Meteor.Collection.apply(this,args);
	var self=this;
	self.isReady=false;
	if(typeof awsOptions.folder!="string")awsOptions.folder=name;
	if(typeof awsOptions.urlPrefix!="string"){
		if(awsOptions.dns){
			awsOptions.urlPrefix="http://"+awsOptions.bucket+"/"+awsOptions.folder;
		}else{
			awsOptions.urlPrefix="http://"+awsOptions.bucket+".s3.amazonaws.com/"+awsOptions.folder;
		}
	}
	if(typeof awsOptions.sslEnabled!="boolean")awsOptions.sslEnabled=true;
	if(typeof awsOptions.ACL!="string")awsOptions.ACL="public-read";
	self.awsOptions=_.clone(awsOptions);
	var s3client=new AWS.S3.Client({accessKeyId:awsOptions.accessKey,secretAccessKey:awsOptions.secretKey,sslEnabled:awsOptions.sslEnabled});
	var bucketALC;
	var _getBucketAcl=function(){
		s3client.getBucketAcl({Bucket:awsOptions.bucket}, function(err, data){
			if(err==null){
				bucketALC=data;
				self.isReady=true;
				self.s3client=s3client;
				self.bucketALC=bucketALC;
				if(typeof awsOptions.onReady=="function"){
					awsOptions.onReady();
				}
				return;
			}
			console.log("ERROR Amazon S3");
			console.log("-> can't get bucket '"+awsOptions.bucket+"' ALC");
			Meteor.setTimeout(_getBucketAcl, 30*1000);
		})
	}
	_getBucketAcl();
	//this.deny({insert:function(){return true}});
	//this._allowInsertCB=[];
	//this._denyInsertCB=[];
};
FileCollection.prototype = Object.create(Meteor.Collection.prototype);
FileCollection.prototype.constructor = FileCollection;
FileCollection.defaults=function(options){
	if(options==undefined)return defaultOptions;
	if(_.isObject(options)&&_.isObject(options.aws)){
		defaultOptions.aws=_.clone(options.aws)
	}
}
//convert(obj,buffer,cb:function(err,buffer,type){}) or return {err, buffer, type}
function tryToConvert(obj,buffer,convert){
	var fiber = Fiber.current;
	var stopped=undefined;
	var resulfCB=undefined;
	var result=undefined;
	var resultFN=convert(obj,buffer,function(err,b,type){
		resulfCB={
			err:err,
			buffer:b,
			type:type
		}
		if(stopped){
			stopped=false;
			fiber.run();
		}
		stopped=false;
	})
	if(typeof resultFN=="object"){
		result=resultFN;
	}else if(typeof resulfCB=="object"){
		result=resulfCB;
	}else{
		if(stopped==undefined){
			stopped=true;
			Fiber.yield();
		}
		result=resulfCB;
	}
	if(!result.type) result.type=obj.file.type;
	if((!result.buffer)&&(!result.err) )result.err=true;
	result.convertError=true;
	return result;
}

function tryToSendDocumentToAmazone(collection,converted,id){
	var awsOptions=collection.awsOptions;
	var fiber = Fiber.current;
	var stopped=undefined;
	var result=false;
	var base64data=converted.buffer;
	var type=converted.type;
	collection.s3client.putObject({Bucket:awsOptions.bucket,ContentType:type,ACL:awsOptions.ACL,Body:base64data,Key:awsOptions.folder+"/"+id}, function(err, data){
		if(!err)result=true;
		if(stopped){
			stopped=false;
			fiber.run()
		}
		stopped=false;
	})
	if(stopped==undefined){
		stopped=true;
		Fiber.yield();
	}
	return result
}

sendToAmazone=function(collection,_id,obj){
	if(!obj.file.content){
		if(typeof obj.file.contentUrl!="string")return false;
		try{
			var a=HTTP.call("GET",obj.file.contentUrl,{npmRequestOptions:{encoding:"binary"}});
			if(a.statusCode!=200)return false;
			if(!obj.file.type)obj.file.type=a.headers["content-type"];
			if(!obj.file.size)obj.file.size=a.headers["content-length"];
			if(!obj.file.name)obj.file.name=(function(){
				var tmp=obj.file.contentUrl.split("/");
				tmp=tmp[tmp.length-1];
				return tmp.split("?")[0];
			})()
			obj.file.content=a.content;
			delete obj.file.contentUrl;
		}catch(e){
			return false;
		}
	};
	var base64data=(typeof obj.file.content=="string")?Buffer(obj.file.content,"binary"):obj.file.content;
	var awsOptions=collection.awsOptions;
	var convert=(typeof awsOptions.convert=="function")?{"default":awsOptions.convert}:(
		typeof awsOptions.convert=="object"?awsOptions.convert:undefined
	)
	var docs={};
	if(!convert){
		docs["default"]={err:false,buffer:base64data,type:obj.file.type};
	}else{
		if(typeof convert["default"]!="function"){
			docs["default"]={err:false,buffer:base64data,type:obj.file.type};
		}
		for(var key in convert){
			if(typeof convert[key]!="function")continue;
			docs[key]=tryToConvert(obj,base64data,convert[key])
		}
	}
	var id=Meteor.uuid();
	for(var key in docs){
		if(!docs[key].err){
			docs[key].err=!tryToSendDocumentToAmazone(collection,docs[key],(key=="default")?id:(id+"_"+key))
		}
	}
	var result=!docs["default"].err;
	var passedKeys=[];
	var allKeys=[];
	for(var key in docs){
		var s=_.clone(docs[key]);
		delete s.err;
		delete s.buffer;
		delete s.convertError;
		s.name=key;
		if((key!="default")&&(!key.err))passedKeys.push(s);
		if(key!="default")allKeys.push(s);
	}
	if(result){
		delete obj.file.content;
		obj.file.url=awsOptions.urlPrefix+"/"+id;
		obj.file.id=id;
		obj.file.ACL=awsOptions.ACL;
		obj.file.folder=awsOptions.folder;
		if(passedKeys.length>0){
			obj.file.items=passedKeys;
		}
	}
	return result;
}

FileCollection.prototype.insertFile=function(obj){
	if (sendToAmazone(this,null,obj)) return this.insert(obj);
}

FileCollection.prototype.allow=function(_obj){
	var obj=_.clone(_obj);
	args=_.toArray(arguments);
	args[0]=obj;
	var self=this;
	if( (typeof obj=="object")&&(typeof obj.insert=="function") ){
		//this._allowInsertCB.push(obj.insert);
		var insrt=obj.insert;
		obj.insert=function(_id,obj){
			var result=insrt.call(this,_id,obj)
			//if( (self._denyInsertCB.length==0)&&(result) ){
			if(result){
				result=sendToAmazone(self,_id,obj)
			}
			return result;
		}
	}
	return Meteor.Collection.prototype.allow.apply(this,args)
}
/*
FileCollection.prototype.deny=function(obj){
	var self=this;
	if( (typeof obj=="object")&&(typeof obj.insert=="function") ){
		this._denyInsertCB.push(obj.insert);
		var insrt=obj.insert;
		var count=self._denyInsertCB.length;
		obj.insert=function(_id,obj){
			console.log("DENY")
			var result=insrt.call(this,_id,obj)
			if((count==self._denyInsertCB.length)&&(!result) ){
				result=!sendToAmazone(self,_id,obj)
			}
			return result;
		}
	}
	return Meteor.Collection.prototype.deny.apply(this,arguments)
}*/