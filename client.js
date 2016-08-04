FileCollection = function FileCollection () {
	var name = arguments[0];
	Meteor.Collection.apply(this,arguments);
	FileCollection._collections[name] = this;
};
FileCollection._collections = {};
FileCollection.prototype = Object.create(Meteor.Collection.prototype);
FileCollection.prototype.constructor = FileCollection;
FileCollection.prototype.insert=function(data,callback){
	if(data instanceof File)data={file:data};
	if(!(data.file instanceof File) )return;
	var reader = new FileReader();
	var self=this;
	reader.onloadend=function(e){
		if(e.target.result!=null){
			var d=_.clone(data);
			d.file={
				content:e.target.result,
				name:data.file.name,
				type:data.file.type,
				size:data.file.size
			}
			Meteor.Collection.prototype.insert.call(self,d,function(error,_id){
				if(typeof callback=="function"){callback(error,_id)}
			})
		   
		}else{
			if(typeof callback=="function")callback("not loaded");
		}
	}
	reader.readAsBinaryString(data.file);
}
Template.UploadFileButton.helpers({
	isMultiple:function(){
		return !!Template.currentData().multiple
	},
	accept:function(){
		var accept=Template.currentData().accept
		return (typeof accept=="string")?accept:"*"
	},
	title:function(){
		var title=Template.currentData().title;
		return (typeof title=="function")?title():(typeof title=="string")?title:"Upload"
	}
})
Template.UploadFileButton.events({
	"change .uploadInput":function(evt){
		cd=Template.currentData();
		var reader = new FileReader();
		var oneStep=function(file,callback){
			reader.onloadend=function(e){
				if(e.target.result!=null){
					if(!cd.collection)return;
					var collection =  typeof cd.collection == "string"? FileCollection._collections[cd.collection]: cd.collection;
					var obj={file:file}
					if(typeof cd.onInsert=="function"){
						console.log("runing onInsert")
						cd.onInsert(obj)
					}
					collection.insert(obj,function(err,_id){
						if(typeof cd.onInserted=="function")cd.onInserted(err,_id);
						callback();
					})
				}else{
					callback();
				}
			}
			reader.readAsBinaryString(file);
		}
		var stepByStep=function(i,callback){
			if(i<evt.target.files.length){
				oneStep(evt.target.files[i],function(){callback(i+1,stepByStep)})
			}else{}
		}
		stepByStep(0,stepByStep);
	},
	"click .btn":function(e, inst){
		e.stopPropagation();
		e.preventDefault();
		e.target.previousElementSibling.lastElementChild.click()
	}
})