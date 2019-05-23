var rotationResultObjs;

var whereClause = "source.name = 'ncbi-curated' and exclude_from_almt_tree = false";

glue.command(["multi-unset", "field", "sequence", "-w", whereClause, "rotation"]);

glue.inMode("module/hbvBlastSequenceRotator", function() {
	rotationResultObjs = glue.tableToObjects(glue.command(["rotate", "sequence", "-w", whereClause]));
}); 

_.each(rotationResultObjs, function(rotationResultObj) {
	if(rotationResultObj.status == "NO_ROTATION_NECESSARY") {
		// do nothing.
	} else if(rotationResultObj.status == "ROTATION_NECESSARY") {
		glue.inMode("sequence/"+rotationResultObj.querySequenceId, function() {
			glue.command(["set", "field", "rotation", rotationResultObj.rotationNts]);
		});
	} else {
		throw new Error("Unexpected rotation status '"+rotationResultObj.status+"' for sequence "+rotationResultObj.querySequenceId);
	}
});