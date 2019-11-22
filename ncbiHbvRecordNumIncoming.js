var numIncoming = glue.command(["count", "sequence", 
                                "-w", "source.name = 'ncbi-curated' and ncbi_incoming = true"]).countResult.count;

glue.command(["file-util", "save-string", numIncoming.toString(), "tmp/numIncoming.txt"]);