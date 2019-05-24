var rotationResultObjs;

var whereClause = "source.name = 'ncbi-curated' and exclude_from_almt_tree = false";

glue.command(["multi-unset", "field", "sequence", "-w", whereClause, "rotation"]);

glue.inMode("module/hbvBlastSequenceRotator", function() {
	rotationResultObjs = glue.tableToObjects(glue.command(["rotate", "sequence", "-w", whereClause]));
}); 

var processed = 0;

_.each(rotationResultObjs, function(rotationResultObj) {
	var rotationNts;
	if(rotationResultObj.status == "NO_ROTATION_NECESSARY") {
		rotationNts = 0;
	} else if(rotationResultObj.status == "ROTATION_NECESSARY") {
		rotationNts = rotationResultObj.rotationNts;
	} else {
		rotationNts = null;
	}
	if(rotationNts != null) {
		glue.inMode("sequence/"+rotationResultObj.querySequenceId, function() {
			glue.command(["set", "field", "--noCommit", "rotation", rotationNts]);
		});
		// leave null if rotator could not resolve sequence.
	}
	processed++;

	if(processed % 250 == 0) {
		glue.command(["commit"]);
		glue.command(["new-context"]);
		glue.log("FINEST", "Updated "+processed+" of "+rotationResultObjs.length+" sequences");
	}
});

glue.command(["commit"]);
glue.command(["new-context"]);
glue.log("FINEST", "Updated "+processed+" of "+rotationResultObjs.length+" sequences");
