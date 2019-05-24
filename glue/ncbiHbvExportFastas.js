//var genotypes = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "Unclear"];

var genotypes = ["J"];

_.each(genotypes, function(genotype) {
	glue.inMode("module/hbvFastaExporter", function() {
		var recogniser_genotypes_clause;
		if(genotype == 'Unclear') {
			recogniser_genotypes_clause = "recogniser_genotypes like '%/%'"
		} else {
			recogniser_genotypes_clause = "recogniser_genotypes = '"+genotype+"'"
		}
		glue.command(["export", "-w", "source.name = 'ncbi-curated' and exclude_from_almt_tree = false and non_n_length < 3000 and "+recogniser_genotypes_clause, 
			"-f", "Gt_"+genotype+"_subgenomic.fasta"]);
		glue.command(["export", "-w", "source.name = 'ncbi-curated' and exclude_from_almt_tree = false and non_n_length >= 3000 and "+recogniser_genotypes_clause, 
			"-f", "Gt_"+genotype+"_fullgenome.fasta"]);
	});
});

/*
var seqObjs = glue.tableToObjects(glue.command(["list", "sequence", "-w", "source.name = 'ncbi-curated' and exclude_from_almt_tree = false",
		"sequenceID", "m49_country.display_name", "gb_length", "non_n_length", "gb_genotype", "recogniser_genotypes", "reverse_complement", "rotation"]));

var documentResult = {
		"documentResult":{
	        "column":_.keys(seqObjs[0]),
	        "row":_.map(seqObjs, function(obj) {
	        	return {
	                "value":_.values(obj)
	            };
	        })
	    }
	};

glue.inMode("module/tabularUtilityTab", function() {
	glue.command({"save-tabular": {
		"tabularData": documentResult, 
		"fileName": "exportedSequenceData.txt" }
	});
});
*/