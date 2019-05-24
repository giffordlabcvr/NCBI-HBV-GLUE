

var processed = 0;

var whereClause = "source.name = 'ncbi-curated'";

glue.command(["multi-unset", "field", "sequence", "-w", whereClause, "non_n_length"]);

var seqObjs = glue.tableToObjects(glue.command(["list", "sequence", "-w", whereClause]));

glue.log("FINEST", "Updating non-N length for "+seqObjs.length+" sequences");

_.each(seqObjs, function(seqObj) {
	var sequenceID = seqObj.sequenceID;
	var sourceName = seqObj["source.name"];
	
	glue.inMode("sequence/"+sourceName+"/"+sequenceID, function() {
		var nucleotides = glue.command(["show", "nucleotides"]).nucleotidesResult.nucleotides;
		var nonNLength = (nucleotides.match(/[^nN]/g) || []).length;
		glue.command(["set", "field", "--noCommit", "non_n_length", nonNLength]);
	});
	processed++;
	if(processed % 500 == 0) {
		glue.command(["commit"]);
		glue.command(["new-context"]);
		glue.log("FINEST", "Processed "+processed+" of "+seqObjs.length+" sequences");
	}
});
glue.command(["commit"]);
glue.command(["new-context"]);
glue.log("FINEST", "Processed "+processed+" of "+seqObjs.length+" sequences");
