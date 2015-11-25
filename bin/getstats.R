args<-commandArgs(TRUE)

library(popcycle)
set.project.location(args[1])
sfl = get.sfl.table()
stats = get.stat.table()
stats$cruise = args[2]
sfl$cruise = args[2]
write.csv(stats, args[3], row.names=FALSE, quote=FALSE)
write.csv(sfl, args[4], row.names=FALSE, quote=FALSE)

