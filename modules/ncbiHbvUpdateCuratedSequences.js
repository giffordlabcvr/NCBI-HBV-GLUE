function syncCurated() {
	glue.log("INFO", "Synchronizing source "+source.name+" with NCBI...");
	var syncResults;
	glue.inMode("module/"+modules.ncbiImporter, function() {
		syncResults = glue.tableToObjects(glue.command(["sync", "--detailed"]));
		glue.log("FINEST", "NCBI syncronization report", syncResults);
		glue.log("INFO", "Synchronization complete");
	});
	glue.log("INFO", "Deleting surplus sequence files");
	var deleted = 0;
	_.each(syncResults, function(syncResult) {
		if(syncResult.status == "SURPLUS") {
			glue.command(["file-util", "delete-file", "sources/ncbi-curated/"+syncResult.sequenceID+".xml"]);
			deleted++;
		}
	});
	glue.log("INFO", "Deleted "+deleted+" surplus sequence files");
	glue.log("INFO", "Exporting incoming sequences to file system...");
	glue.command(["export", "source", "--whereClause", "ncbi_incoming = null", "--parentDir", source.path, source.name]);
}


function pad(num, size) {
    var s = num+"";
    while (s.length < size) {
    	s = "0" + s;
    }
    return s;
}


function placeCuratedAll() {
	glue.log("INFO", "Deleting files in placement path "+placement.path);
	var placementPathFiles = glue.tableToObjects(glue.command(["file-util", "list-files", "--directory", placement.path]));
	_.each(placementPathFiles, function(placementPathFile) {
		glue.command(["file-util", "delete-file", placement.path+"/"+placementPathFile.fileName]);
	});
	glue.log("INFO", "Deleted "+placementPathFiles.length+" files");
	var fileSuffix = 1;
	var whereClause = "source.name = 'ncbi-curated'";
	placeCurated(whereClause, fileSuffix);
}

function placeCuratedIncoming() {
	var placementPathFiles = glue.tableToObjects(glue.command(["file-util", "list-files", "--directory", placement.path]));
	var placementFileNames = _.map(placementPathFiles, function(placementPathFile) {return placementPathFile.fileName;});
	var fileSuffix = 1;
	while(true) {
		fileSuffixString = pad(fileSuffix, 6);
		if(_.contains(placementFileNames, placement.prefix + fileSuffixString + ".xml")) {
			fileSuffix++;
		} else {
			break;
		}
	}
	var whereClause = "source.name = 'ncbi-curated' and ncbi_incoming = true";
	placeCurated(whereClause, fileSuffix);
}

function placeCurated(whereClause, fileSuffix) {
	glue.log("INFO", "Counting sequences where "+whereClause);
	var numSequences = glue.command(["count", "sequence", "--whereClause", whereClause]).countResult.count;
	glue.log("INFO", "Found "+numSequences+" sequences where "+whereClause);
	var batchSize = 50;
	var offset = 0;
	while(offset < numSequences) {
		glue.log("INFO", "Placing sequences starting at offset "+offset);
		glue.inMode("module/"+modules.placer, function() {
			fileSuffixString = pad(fileSuffix, 6);
			var outputFile = placement.path + "/" + placement.prefix + fileSuffixString + ".xml";
			glue.command(["place", "sequence", 
                           "--whereClause", whereClause,
                           "--pageSize", batchSize, "--fetchLimit", batchSize, "--fetchOffset", offset, 
                           "--outputFile", outputFile]);
		});
		offset += batchSize;
		fileSuffix++;
	}
}


function genotypeCurated() {
	var placementPathFiles = glue.tableToObjects(glue.command(["file-util", "list-files", "--directory", placement.path]));
	
	var alignmentsToRecompute = [];
	
	_.each(placementPathFiles, function(placementPathFile) {
		if(placementPathFile.fileName.indexOf(".xml") < 0) {
			return;
		}
		glue.log("INFO", "Computing genotype results for placement file "+placementPathFile.fileName);
		var batchGenotyperResults;
		glue.inMode("module/"+modules.genotyper, function() {
			batchGenotyperResults = glue.tableToObjects(glue.command(
					["genotype", "placer-result", 
					 "--fileName", placement.path+"/"+placementPathFile.fileName, 
					 "--detailLevel", "HIGH"]));
		});
		glue.log("INFO", "Assigning genotype metadata for "+batchGenotyperResults.length+" genotyping results from placement file "+placementPathFile.fileName);
		var batchSize = 500;
		var numUpdates = 0;
		_.each(batchGenotyperResults, function(genotyperResult) {
			var queryBits = genotyperResult.queryName.split("/");
			var sourceName = queryBits[0];
			var sequenceID = queryBits[1];

			var excludeFromAlmtTree;
			glue.inMode("sequence/"+sourceName+"/"+sequenceID, function() {
				excludeFromAlmtTree = glue.command(["show", "property", "exclude_from_almt_tree"]).propertyValueResult.value;
			});
			
			if(excludeFromAlmtTree == "true") {
				glue.log("FINEST", "Sequence "+sourceName+"/"+sequenceID+" excluded from alignment tree.");
			} else {

				var targetAlignmentName;
				glue.inMode("sequence/"+sourceName+"/"+sequenceID, function() {
					var subgenotype = genotyperResult.subgenotypeFinalClade;
					if(subgenotype) {
						var sgtRegex = /AL_([^_]+)/;
						var sgtMatch = sgtRegex.exec(subgenotype);
						if(sgtMatch) {
							glue.command(["set", "field", "--noCommit", "subgenotype", sgtMatch[1]]);
							if(targetAlignmentName == null) { 
								targetAlignmentName = subgenotype;
							}
						}
					}
					var genotype = genotyperResult.genotypeFinalClade;
					if(genotype) {
						var gtRegex = /AL_([^_]+)/;
						var gtMatch = gtRegex.exec(genotype);
						if(gtMatch) {
							glue.command(["set", "field", "--noCommit", "genotype", gtMatch[1]]);
							if(targetAlignmentName == null) { 
								targetAlignmentName = genotype;
							}
						}
					}
					var species = genotyperResult.speciesFinalClade;
					if(species == "AL_MASTER") {
						glue.command(["set", "field", "--noCommit", "species", "HBV"]);
						if(targetAlignmentName == null) { 
							targetAlignmentName = "AL_MASTER";
						}
					}
				});
				
				if(targetAlignmentName != null) {
					glue.inMode("alignment/"+targetAlignmentName, function() {
						glue.command(["add", "member", sourceName, sequenceID]);
					});

					alignmentsToRecompute.push(targetAlignmentName);
				}
				
				if(numUpdates % batchSize == 0) {
					glue.command("commit");
					glue.command("new-context");
					glue.log("FINE", "Genotype/subgenotype assigned for "+numUpdates+" sequences.");
				}
				numUpdates++;
			}
		});
		glue.command("commit");
		glue.command("new-context");
		glue.log("FINE", "Genotype/subgenotype clade assigned for "+numUpdates+" sequences.");
	});
	
	alignmentsToRecompute = _.uniq(alignmentsToRecompute);
	glue.log("FINE", "Alignments to recompute: ", alignmentsToRecompute);
	
	_.each(alignmentsToRecompute, function(alignmentName) {
		glue.log("FINE", "Recomputing constrained alignment "+alignmentName);
		glue.command(["compute", "alignment", alignmentName, "hbvCompoundAligner",
		              "--whereClause", "sequence.source.name = 'ncbi-curated'"]);
	});
	
}
