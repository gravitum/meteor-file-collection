/*
FileCollection = function FileCollection () {
  Meteor.Collection.apply(this,arguments)
  // body...
};

FileCollection.prototype = Object.create(Meteor.Collection.prototype);

_.extend(FileCollection.prototype, {
  constructor: FileCollection
});

if(Meteor.isClient){
  FileCollection.prototype.insert = function(){
    console.log("new insert method");
    Meteor.Collection.prototype.insert.apply(this,arguments);

  }
}

if(Meteor.isServer){

}
// test.after.insert(function (userId, doc) {
//   // ...
// });

*/