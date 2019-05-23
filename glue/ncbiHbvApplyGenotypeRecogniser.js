/**
 * Run the BLAST-based genotype recogniser on all non-excluded NCBI curated sequences.
 * 
 * This generates for each sequence: 
 * - a recogniser_genotypes result (occasionally multiple genotypes, e.g. "D/C/I" are recognised)
 * - a value for the reverse_complement field, or null if the direction could not be established.
 */

var recogniserResultObjs;

var whereClause = "source.name = 'ncbi-curated' and exclude_from_almt_tree = false";

glue.command(["multi-unset", "field", "sequence", "-w", whereClause, "reverse_complement"]);
glue.command(["multi-unset", "field", "sequence", "-w", whereClause, "recogniser_genotypes"]);

glue.inMode("module/hbvGenotypeRecogniser", function() {
	recogniserResultObjs = glue.tableToObjects(glue.command(["recognise", "sequence", "-w", whereClause]));
}); 


var processed = 0;

var recogniserResultGroups = _.groupBy(recogniserResultObjs, "querySequenceId");

var recogniserResultGroupPairs = _.pairs(recogniserResultGroups);

_.each(recogniserResultGroupPairs, function(pair) {
	var querySequenceId = pair[0];
	var recogniserResultRowObjs = pair[1];
	
	var reverseComplement = null;
	var recogniserGenotypes = null;
	
	if(recogniserResultRowObjs.length == 1) {
		if(recogniserResultRowObjs[0].categoryId != null) {
			// recognised by at least one category
			reverseComplement = recogniserResultRowObjs[0].direction == "FORWARD" ? "false" : "true";
			recogniserGenotypes = recogniserResultRowObjs[0].categoryId;
		} else {
			// leave both fields null
		}
	} else {
		var directions = _.uniq(_.map(recogniserResultRowObjs, function(ob) {return ob.direction;}));
		if(directions.length == 1) {
			reverseComplement = directions[0] == "FORWARD" ? "false" : "true";
		} else {
			// multiple directions, leave reverse_complement null
		}
		recogniserGenotypes = _.uniq(_.map(recogniserResultRowObjs, function(ob) {return ob.categoryId;})).join("/");
	}

	glue.inMode("sequence/"+querySequenceId, function() {
		if(reverseComplement != null) {
			glue.command(["set", "field", "--noCommit", "reverse_complement", reverseComplement]);
		}
		if(recogniserGenotypes != null) {
			glue.command(["set", "field", "--noCommit", "recogniser_genotypes", recogniserGenotypes]);
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
