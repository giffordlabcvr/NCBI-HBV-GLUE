/**
 * Run the BLAST-based sequence recogniser on all non-excluded NCBI curated sequences.
 * 
 * This generates for each sequence: 
 * - a boolean: whether it is HBV or not
 * - a value for the reverse_complement field, or null if the direction could not be established.
 */

var recogniserResultObjs;

var whereClause = "source.name = 'ncbi-curated' and exclude_from_almt_tree = false";

glue.command(["multi-unset", "field", "sequence", "-w", whereClause, "reverse_complement"]);
glue.command(["multi-unset", "field", "sequence", "-w", whereClause, "is_hbv"]);

glue.inMode("module/hbvSequenceRecogniser", function() {
	recogniserResultObjs = glue.tableToObjects(glue.command(["recognise", "sequence", "-w", whereClause]));
}); 


var processed = 0;

var recogniserResultGroups = _.groupBy(recogniserResultObjs, "querySequenceId");

var recogniserResultGroupPairs = _.pairs(recogniserResultGroups);

_.each(recogniserResultGroupPairs, function(pair) {
	var querySequenceId = pair[0];
	var recogniserResultRowObjs = pair[1];
	
	var reverseComplement = null;
	var isHbv = false;
	
	if(recogniserResultRowObjs.length == 1) {
		if(recogniserResultRowObjs[0].categoryId == "HBV") {
			isHbv = true;
			// recognised as HBV
			if(recogniserResultRowObjs[0].direction == "FORWARD") {
				reverseComplement = false;
			} else if(recogniserResultRowObjs[0].direction == "REVERSE") {
				reverseComplement = true;
			} 
		} 
	} else if(recogniserResultRowObjs.length == 2) {
		if(recogniserResultRowObjs[0].categoryId == "HBV" && recogniserResultRowObjs[1].categoryId == "HBV") {
			isHbv = true;
			if(recogniserResultRowObjs[0].direction == "FORWARD" && recogniserResultRowObjs[1].direction == "REVERSE") {
				reverseComplement = null;
			} else if(recogniserResultRowObjs[0].direction == "REVERSE" && recogniserResultRowObjs[1].direction == "FORWARD") {
				reverseComplement = null;
			}
		}
	}

	glue.inMode("sequence/"+querySequenceId, function() {
		if(reverseComplement != null) {
			glue.command(["set", "field", "--noCommit", "reverse_complement", reverseComplement]);
		}
		if(isHbv != null) {
			glue.command(["set", "field", "--noCommit", "is_hbv", isHbv]);
		}
	});
	processed++;

	if(processed % 250 == 0) {
		glue.command(["commit"]);
		glue.command(["new-context"]);
		glue.log("FINEST", "Updated "+processed+" of "+recogniserResultGroupPairs.length+" sequences");
	}

});

glue.command(["commit"]);
glue.command(["new-context"]);
glue.log("FINEST", "Updated "+processed+" of "+recogniserResultGroupPairs.length+" sequences");
