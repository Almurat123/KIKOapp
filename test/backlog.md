2026-02-04T12:57:09.610965139Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:57:09.610968978Z [err]  }
2026-02-04T12:57:19.521768921Z [err]    code: 'P2022',
2026-02-04T12:57:19.521780031Z [err]    clientVersion: '5.22.0',
2026-02-04T12:57:19.521786296Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:57:19.521792448Z [err]  }
2026-02-04T12:57:19.521828299Z [err]  [Prisma-Error] 
2026-02-04T12:57:19.521843684Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:57:19.521854237Z [err]  
2026-02-04T12:57:19.521866301Z [err]  
2026-02-04T12:57:19.521875587Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:57:19.488Z }
2026-02-04T12:57:19.521884065Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:57:19.521894609Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:57:19.521903078Z [err]  
2026-02-04T12:57:19.521911964Z [err]  
2026-02-04T12:57:19.521922417Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:57:19.521922450Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:57:19.521932869Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:57:19.521940886Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:57:19.521949063Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:57:19.521957555Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:57:19.521966052Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:57:19.521975131Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:57:39.211692046Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:57:39.211699269Z [err]  [Prisma-Error] 
2026-02-04T12:57:39.211704459Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:57:39.211709037Z [err]  
2026-02-04T12:57:39.211714379Z [err]  
2026-02-04T12:57:39.211719150Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:57:29.512Z }
2026-02-04T12:57:39.211724654Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:57:39.211730044Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:57:39.211734642Z [err]  
2026-02-04T12:57:39.211739248Z [err]  
2026-02-04T12:57:39.211743400Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:57:39.211748101Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:57:39.211752579Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:57:39.211757052Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:57:39.211761772Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:57:39.211766176Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:57:39.211771686Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:57:39.211775882Z [err]    code: 'P2022',
2026-02-04T12:57:39.211780516Z [err]    clientVersion: '5.22.0',
2026-02-04T12:57:39.211784792Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:57:39.211789305Z [err]  }
2026-02-04T12:57:39.628818963Z [err]    code: 'P2022',
2026-02-04T12:57:39.628830466Z [err]    clientVersion: '5.22.0',
2026-02-04T12:57:39.628837493Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:57:39.628845370Z [err]  }
2026-02-04T12:57:39.628861509Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:57:39.628867023Z [err]  
2026-02-04T12:57:39.628873130Z [err]  
2026-02-04T12:57:39.628878433Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:57:39.628882950Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:57:39.628888378Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:57:39.628894257Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:57:39.628899783Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:57:39.628907918Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:57:39.628913339Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:57:39.628988974Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:57:39.629000479Z [err]  [Prisma-Error] 
2026-02-04T12:57:39.629011503Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:57:39.629022616Z [err]  
2026-02-04T12:57:39.629035472Z [err]  
2026-02-04T12:57:39.629046388Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:57:39.534Z }
2026-02-04T12:57:39.629058317Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:57:59.297184742Z [err]  }
2026-02-04T12:57:59.297216647Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:57:59.297226309Z [err]  [Prisma-Error] 
2026-02-04T12:57:59.297235377Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:57:59.297243962Z [err]  
2026-02-04T12:57:59.297253315Z [err]  
2026-02-04T12:57:59.297262788Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:57:49.558Z }
2026-02-04T12:57:59.297272265Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:57:59.297280705Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:57:59.297288192Z [err]  
2026-02-04T12:57:59.297296561Z [err]  
2026-02-04T12:57:59.297305758Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:57:59.297314502Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:57:59.297323320Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:57:59.297332090Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:57:59.297340964Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:57:59.297348808Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:57:59.297358630Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:57:59.297368230Z [err]    code: 'P2022',
2026-02-04T12:57:59.297376236Z [err]    clientVersion: '5.22.0',
2026-02-04T12:57:59.297384838Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:57:59.750196719Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:57:59.750201873Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:57:59.750208288Z [err]  [Prisma-Error] 
2026-02-04T12:57:59.750211562Z [err]    code: 'P2022',
2026-02-04T12:57:59.750215374Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:57:59.750222359Z [err]  
2026-02-04T12:57:59.750224114Z [err]    clientVersion: '5.22.0',
2026-02-04T12:57:59.750229636Z [err]  
2026-02-04T12:57:59.750235465Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:57:59.750237708Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:57:59.583Z }
2026-02-04T12:57:59.750244533Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:57:59.750247400Z [err]  }
2026-02-04T12:57:59.750252236Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:57:59.750257285Z [err]  
2026-02-04T12:57:59.750262402Z [err]  
2026-02-04T12:57:59.750267883Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:57:59.750275082Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:57:59.750285858Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:57:59.750291068Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:57:59.750296596Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:57:59.750301853Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:58:06.079214903Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:58:06.230369238Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:58:06.364919795Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:58:06.766484197Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:58:06.766494547Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:58:06.808469749Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:58:06.962369628Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:58:07.113755304Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:58:09.804940436Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:58:09.804949980Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:58:09.804956310Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:58:09.804962613Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:58:09.804967926Z [err]    code: 'P2022',
2026-02-04T12:58:09.804973650Z [err]    clientVersion: '5.22.0',
2026-02-04T12:58:09.804989722Z [err]  
2026-02-04T12:58:09.804996105Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:58:09.607Z }
2026-02-04T12:58:09.805001944Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:58:09.805008002Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:58:09.805014456Z [err]  
2026-02-04T12:58:09.805020230Z [err]  
2026-02-04T12:58:09.805025856Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:58:09.805031073Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:58:09.805037125Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:58:09.805064508Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:58:09.805069753Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:58:09.805076758Z [err]  [Prisma-Error] 
2026-02-04T12:58:09.805080122Z [err]  }
2026-02-04T12:58:09.805086051Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:58:09.805095178Z [err]  
2026-02-04T12:58:29.407679278Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:58:29.407679361Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:58:29.407685432Z [err]  [Prisma-Error] 
2026-02-04T12:58:29.407693264Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:58:29.407694959Z [err]  }
2026-02-04T12:58:29.407699766Z [err]  
2026-02-04T12:58:29.407705631Z [err]  
2026-02-04T12:58:29.407711016Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:58:19.629Z }
2026-02-04T12:58:29.407717351Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:58:29.407721936Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:58:29.407726592Z [err]  
2026-02-04T12:58:29.407732154Z [err]  
2026-02-04T12:58:29.407737271Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:58:29.407741904Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:58:29.407746069Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:58:29.407750867Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:58:29.407755454Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:58:29.407760442Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:58:29.407766369Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:58:29.407771282Z [err]    code: 'P2022',
2026-02-04T12:58:29.407775860Z [err]    clientVersion: '5.22.0',
2026-02-04T12:58:30.032888951Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:58:30.032893917Z [err]  [Prisma-Error] 
2026-02-04T12:58:30.032898665Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:58:30.032903412Z [err]  
2026-02-04T12:58:30.032909122Z [err]  
2026-02-04T12:58:30.032913341Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:58:29.652Z }
2026-02-04T12:58:30.032918252Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:58:30.032922717Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:58:30.032927658Z [err]  
2026-02-04T12:58:30.032932073Z [err]  
2026-02-04T12:58:30.032936505Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:58:30.032940828Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:58:30.032947015Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:58:30.032951979Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:58:30.032956426Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:58:30.032962035Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:58:30.032966780Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:58:30.032971275Z [err]    code: 'P2022',
2026-02-04T12:58:30.032976437Z [err]    clientVersion: '5.22.0',
2026-02-04T12:58:30.032981153Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:58:30.032985628Z [err]  }
2026-02-04T12:58:39.992878285Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:58:39.992893557Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:58:39.992897014Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:58:39.992904398Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:58:39.992912469Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:58:39.992925238Z [err]  
2026-02-04T12:58:39.992925786Z [err]  
2026-02-04T12:58:39.992928187Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:58:39.992935712Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:58:39.992938189Z [err]  
2026-02-04T12:58:39.992941362Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:58:39.992942268Z [err]  
2026-02-04T12:58:39.992948164Z [err]  [Prisma-Error] 
2026-02-04T12:58:39.992954436Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:58:39.992956328Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:58:39.677Z }
2026-02-04T12:58:39.992960444Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:58:39.992969410Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:58:39.993006132Z [err]    code: 'P2022',
2026-02-04T12:58:39.993022464Z [err]    clientVersion: '5.22.0',
2026-02-04T12:58:39.993033451Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:58:39.993054074Z [err]  }
2026-02-04T12:58:49.957603261Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:58:49.957612885Z [err]  [Prisma-Error] 
2026-02-04T12:58:49.957623975Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:58:49.957631910Z [err]  
2026-02-04T12:58:49.957640473Z [err]  
2026-02-04T12:58:49.957647973Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:58:49.700Z }
2026-02-04T12:58:49.957655448Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:58:49.957669273Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:58:49.957679866Z [err]  
2026-02-04T12:58:49.957689563Z [err]  
2026-02-04T12:58:49.957698623Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:58:49.957709066Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:58:49.957717377Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:58:49.957728303Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:58:49.957735902Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:58:49.957746436Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:58:49.957753633Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:58:49.957762249Z [err]    code: 'P2022',
2026-02-04T12:58:49.957772979Z [err]    clientVersion: '5.22.0',
2026-02-04T12:58:49.957780800Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:58:49.957788175Z [err]  }
2026-02-04T12:59:09.645473290Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:59:09.645480584Z [err]  [Prisma-Error] 
2026-02-04T12:59:09.645486220Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:09.645491885Z [err]  
2026-02-04T12:59:09.645497412Z [err]  
2026-02-04T12:59:09.645502694Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:58:59.724Z }
2026-02-04T12:59:09.645507885Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:59:09.645513501Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:09.645519920Z [err]  
2026-02-04T12:59:09.645525721Z [err]  
2026-02-04T12:59:09.645530887Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:59:09.645535510Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:59:09.645546600Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:59:09.645552304Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:59:09.645557223Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:59:09.645562122Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:59:09.645567610Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:59:09.645573508Z [err]    code: 'P2022',
2026-02-04T12:59:09.645579105Z [err]    clientVersion: '5.22.0',
2026-02-04T12:59:09.645583970Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:59:09.645588961Z [err]  }
2026-02-04T12:59:09.645594338Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:59:09.646316983Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:59:09.646323752Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:59:09.646328622Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:59:09.646334795Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:59:09.646339121Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:59:09.646343568Z [inf]  Alpha Detector: Checking new coin
2026-02-04T12:59:10.172696172Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:59:10.172707282Z [err]  [Prisma-Error] 
2026-02-04T12:59:10.172716546Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:10.172726437Z [err]  
2026-02-04T12:59:10.172735565Z [err]  
2026-02-04T12:59:10.172744577Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:59:09.746Z }
2026-02-04T12:59:10.172755652Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:59:10.172764436Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:10.172772790Z [err]  
2026-02-04T12:59:10.172781095Z [err]  
2026-02-04T12:59:10.172790009Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:59:10.172799684Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:59:10.172808891Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:59:10.172817863Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:59:10.172827266Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:59:10.172835984Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:59:10.172845407Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:59:10.172856238Z [err]    code: 'P2022',
2026-02-04T12:59:10.172867970Z [err]    clientVersion: '5.22.0',
2026-02-04T12:59:10.172877019Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:59:10.172886447Z [err]  }
2026-02-04T12:59:29.715631747Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:59:29.715638927Z [err]  [Prisma-Error] 
2026-02-04T12:59:29.715645727Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:29.715652873Z [err]  
2026-02-04T12:59:29.715662107Z [err]  
2026-02-04T12:59:29.715668744Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:59:19.770Z }
2026-02-04T12:59:29.715677095Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:59:29.715684640Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:29.715692012Z [err]  
2026-02-04T12:59:29.715699333Z [err]  
2026-02-04T12:59:29.715707417Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:59:29.715715138Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:59:29.715722537Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:59:29.715730281Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:59:29.715736860Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:59:29.715742811Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:59:29.715749516Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:59:29.715755730Z [err]    code: 'P2022',
2026-02-04T12:59:29.715763091Z [err]    clientVersion: '5.22.0',
2026-02-04T12:59:29.715770547Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:59:29.715777681Z [err]  }
2026-02-04T12:59:29.775932142Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:59:30.136274460Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:59:29.795Z }
2026-02-04T12:59:30.136286371Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:59:30.136294499Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:30.136304093Z [err]  
2026-02-04T12:59:30.136310524Z [err]  
2026-02-04T12:59:30.136316926Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:59:30.136323022Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:59:30.136328363Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:59:30.136336483Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:59:30.136342823Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:59:30.136348280Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:59:30.136353748Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:59:30.136361084Z [err]    code: 'P2022',
2026-02-04T12:59:30.136366883Z [err]    clientVersion: '5.22.0',
2026-02-04T12:59:30.136373528Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:59:30.136380369Z [err]  }
2026-02-04T12:59:30.136748968Z [err]  [Prisma-Error] 
2026-02-04T12:59:30.136754901Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:30.136760125Z [err]  
2026-02-04T12:59:30.136765430Z [err]  
2026-02-04T12:59:39.808002392Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:59:39.822740943Z [err]  [Prisma-Error] 
2026-02-04T12:59:39.822747917Z [err]    code: 'P2022',
2026-02-04T12:59:39.822749597Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:39.822757997Z [err]  
2026-02-04T12:59:39.822759895Z [err]    clientVersion: '5.22.0',
2026-02-04T12:59:39.822764527Z [err]  
2026-02-04T12:59:39.822767657Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:59:39.822771488Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:59:39.820Z }
2026-02-04T12:59:39.822776740Z [err]  }
2026-02-04T12:59:39.822778681Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:59:39.822784487Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:39.822789481Z [err]  
2026-02-04T12:59:39.822794185Z [err]  
2026-02-04T12:59:39.822798449Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:59:39.822802737Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:59:39.822807402Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:59:39.822812863Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:59:39.822818133Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:59:39.822822293Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:59:39.822827968Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:59:59.811070627Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:59:59.811075892Z [err]  [Prisma-Error] 
2026-02-04T12:59:59.811081043Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:59.811085792Z [err]  
2026-02-04T12:59:59.811090202Z [err]  
2026-02-04T12:59:59.811094535Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:59:49.842Z }
2026-02-04T12:59:59.811099575Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:59:59.811105343Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:59.811110095Z [err]  
2026-02-04T12:59:59.811119782Z [err]  
2026-02-04T12:59:59.811126094Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:59:59.811131200Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:59:59.811136730Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:59:59.811144212Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:59:59.811152040Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:59:59.811160419Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:59:59.811169215Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T12:59:59.811176265Z [err]    code: 'P2022',
2026-02-04T12:59:59.811183673Z [err]    clientVersion: '5.22.0',
2026-02-04T12:59:59.811191790Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:59:59.811200320Z [err]  }
2026-02-04T12:59:59.844823930Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T12:59:59.870040938Z [err]  [Prisma-Error] 
2026-02-04T12:59:59.870050875Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:59.870059435Z [err]  
2026-02-04T12:59:59.870068372Z [err]  
2026-02-04T12:59:59.870077314Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T12:59:59.866Z }
2026-02-04T12:59:59.870086220Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T12:59:59.870089592Z [err]    code: 'P2022',
2026-02-04T12:59:59.870098021Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T12:59:59.870103700Z [err]    clientVersion: '5.22.0',
2026-02-04T12:59:59.870110490Z [err]  
2026-02-04T12:59:59.870116034Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T12:59:59.870124706Z [err]  }
2026-02-04T12:59:59.870163300Z [err]  
2026-02-04T12:59:59.870176552Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T12:59:59.870188860Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T12:59:59.870200937Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T12:59:59.870212290Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T12:59:59.870226743Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T12:59:59.870239825Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T12:59:59.870248755Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:00:00.542752671Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T13:00:00.542762991Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T13:00:00.542771738Z [inf]  Fetching premium trending tokens
2026-02-04T13:00:00.675293912Z [err]  [Job] Real hot users file not found: 
2026-02-04T13:00:00.705774494Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T13:00:00.705779135Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T13:00:00.882959130Z [inf]  WS addresses discovered
2026-02-04T13:00:02.007417752Z [inf]  [SocialJob] fetchCastsFromUsers starting with 609 FIDs, target: 1000
2026-02-04T13:00:02.007512224Z [inf]  [Job] ✅ Got 609 quality users from database
2026-02-04T13:00:02.979750178Z [inf]  Processed DexScreener trending candidates
2026-02-04T13:00:05.965562733Z [inf]  Skipping low liquidity token
2026-02-04T13:00:09.078989064Z [inf]  Trending tokens fetch complete
2026-02-04T13:00:09.079002023Z [inf]  Premium trending tokens fetch complete
2026-02-04T13:00:09.079011825Z [inf]  [TokenJob] Got 100 trending tokens for Ethereum
2026-02-04T13:00:09.715823730Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:00:09.873991659Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:00:09.973226884Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:00:09.973230921Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:00:09.973240991Z [err]  [Prisma-Error] 
2026-02-04T13:00:09.973248402Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:00:09.973252775Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:00:09.973260535Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:00:09.973266189Z [err]  
2026-02-04T13:00:09.973270817Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:00:09.973278256Z [err]  
2026-02-04T13:00:09.973281697Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:00:09.973290042Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:00:09.966Z }
2026-02-04T13:00:09.973292687Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:00:09.973303626Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:00:09.973312654Z [err]    code: 'P2022',
2026-02-04T13:00:09.973313360Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:00:09.973324629Z [err]  
2026-02-04T13:00:09.973324709Z [err]    clientVersion: '5.22.0',
2026-02-04T13:00:09.973334864Z [err]  
2026-02-04T13:00:09.973342679Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:00:09.974954711Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:00:09.974966852Z [err]  }
2026-02-04T13:00:10.172127192Z [inf]  Saved 100 trending tokens for eth to database and memory cache
2026-02-04T13:00:10.190089311Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:00:10.649328378Z [inf]  [TokenJob] Saved 100 tokens for Ethereum to DB + cache
2026-02-04T13:00:10.649339221Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:00:10.649349019Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:00:10.649358242Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:00:10.762500261Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:00:20.673853023Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:00:20.860255765Z [err]  }
2026-02-04T13:00:20.860277930Z [err]  [Prisma-Error] 
2026-02-04T13:00:20.860287965Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:00:20.860296702Z [err]  
2026-02-04T13:00:20.860304955Z [err]  
2026-02-04T13:00:20.860314383Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:00:20.853Z }
2026-02-04T13:00:20.860322457Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:00:20.860332093Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:00:20.860340622Z [err]  
2026-02-04T13:00:20.860348738Z [err]  
2026-02-04T13:00:20.860358234Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:00:20.860365886Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:00:20.860374802Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:00:20.860383323Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:00:20.860392794Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:00:20.860408866Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:00:20.860417476Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:00:20.860425697Z [err]    code: 'P2022',
2026-02-04T13:00:20.860434391Z [err]    clientVersion: '5.22.0',
2026-02-04T13:00:20.860442648Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:00:30.860357642Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:00:30.888513574Z [err]  [Prisma-Error] 
2026-02-04T13:00:30.888522832Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:00:30.888531308Z [err]  
2026-02-04T13:00:30.888539823Z [err]  
2026-02-04T13:00:30.888547902Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:00:30.878Z }
2026-02-04T13:00:30.888555937Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:00:30.888563819Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:00:30.888573720Z [err]  
2026-02-04T13:00:30.888581742Z [err]  
2026-02-04T13:00:30.888590244Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:00:30.888597903Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:00:30.888606628Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:00:30.888614880Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:00:30.888623048Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:00:30.888630924Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:00:30.888638482Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:00:30.888646492Z [err]    code: 'P2022',
2026-02-04T13:00:30.888654999Z [err]    clientVersion: '5.22.0',
2026-02-04T13:00:30.888662973Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:00:30.888671100Z [err]  }
2026-02-04T13:00:40.876594725Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T13:00:40.876603361Z [inf]  Fetching premium trending tokens
2026-02-04T13:00:40.885934717Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:00:40.911754481Z [err]  [Prisma-Error] 
2026-02-04T13:00:40.911764053Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:00:40.911773686Z [err]  
2026-02-04T13:00:40.911782857Z [err]  
2026-02-04T13:00:40.911792275Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:00:40.904Z }
2026-02-04T13:00:40.911802823Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:00:40.911812084Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:00:40.911820865Z [err]  
2026-02-04T13:00:40.911828754Z [err]  
2026-02-04T13:00:40.911838257Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:00:40.911847570Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:00:40.911856660Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:00:40.911865201Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:00:40.911873673Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:00:40.911882139Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:00:40.911891764Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:00:40.911900051Z [err]    code: 'P2022',
2026-02-04T13:00:40.911909215Z [err]    clientVersion: '5.22.0',
2026-02-04T13:00:40.911919611Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:00:40.911928793Z [err]  }
2026-02-04T13:00:40.979956436Z [inf]  WS addresses discovered
2026-02-04T13:00:43.062405015Z [inf]  Processed DexScreener trending candidates
2026-02-04T13:00:43.062414017Z [inf]  Premium trending tokens fetch complete
2026-02-04T13:00:43.062422533Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T13:00:43.915658583Z [inf]  Saved 100 trending tokens for solana to database and memory cache
2026-02-04T13:00:43.915667082Z [inf]  [TokenJob] Saved 100 tokens for Solana to DB + cache
2026-02-04T13:00:51.011417887Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:00:51.011426845Z [err]  [Prisma-Error] 
2026-02-04T13:00:51.011435200Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:00:51.011444537Z [err]  
2026-02-04T13:00:51.011453703Z [err]  
2026-02-04T13:00:51.011462760Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:00:50.927Z }
2026-02-04T13:00:51.011472793Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:00:51.011481975Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:00:51.011491800Z [err]  
2026-02-04T13:00:51.011502850Z [err]  
2026-02-04T13:00:51.011511812Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:00:51.011522976Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:00:51.011533547Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:00:51.011543294Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:00:51.011551970Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:00:51.011560924Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:00:51.011569540Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:00:51.011579458Z [err]    code: 'P2022',
2026-02-04T13:00:51.011589019Z [err]    clientVersion: '5.22.0',
2026-02-04T13:00:51.011598296Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:00:51.011610777Z [err]  }
2026-02-04T13:01:00.944619699Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:01:00.961698231Z [err]  [Prisma-Error] 
2026-02-04T13:01:00.961711615Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:00.961720729Z [err]  
2026-02-04T13:01:00.961729938Z [err]  
2026-02-04T13:01:00.961741528Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:01:00.950Z }
2026-02-04T13:01:00.961751078Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:01:00.961759960Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:00.961768638Z [err]  
2026-02-04T13:01:00.961777234Z [err]  
2026-02-04T13:01:00.961786976Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:01:00.961797223Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:01:00.961807703Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:01:00.961816852Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:01:00.961825046Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:01:00.961833614Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:01:00.961843811Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:01:00.961852971Z [err]    code: 'P2022',
2026-02-04T13:01:00.961861928Z [err]    clientVersion: '5.22.0',
2026-02-04T13:01:00.961871089Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:01:00.961879406Z [err]  }
2026-02-04T13:01:10.960369029Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:01:11.064859476Z [err]  [Prisma-Error] 
2026-02-04T13:01:11.064863946Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:01:11.064878087Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:11.064880676Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:01:11.064893360Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:01:11.064894564Z [err]  
2026-02-04T13:01:11.064905334Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:01:11.064910487Z [err]  
2026-02-04T13:01:11.064922495Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:01:11.064924335Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:01:11.053Z }
2026-02-04T13:01:11.064935821Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:01:11.064936306Z [err]    code: 'P2022',
2026-02-04T13:01:11.064947013Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:11.064948704Z [err]    clientVersion: '5.22.0',
2026-02-04T13:01:11.064957918Z [err]  
2026-02-04T13:01:11.064959571Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:01:11.064969741Z [err]  
2026-02-04T13:01:11.064970752Z [err]  }
2026-02-04T13:01:11.064980294Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:01:11.064989249Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:01:12.048564724Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:01:12.952532986Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:01:13.929808657Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T13:01:13.929813756Z [inf]  Fetching premium trending tokens
2026-02-04T13:01:13.929821535Z [inf]  WS addresses discovered
2026-02-04T13:01:14.840866039Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:01:14.840872173Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:01:14.840881219Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:01:15.106466251Z [inf]  Processed DexScreener trending candidates
2026-02-04T13:01:15.982072718Z [inf]  Repeated x3: API-5001:Skipping low liquidity token
2026-02-04T13:01:15.982080318Z [inf]  Skipping low liquidity token
2026-02-04T13:01:16.922686628Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T13:01:18.128795432Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T13:01:20.345724887Z [err]  Error fetching trending tokens
2026-02-04T13:01:20.345733026Z [inf]  Premium trending tokens fetch complete
2026-02-04T13:01:20.345740134Z [inf]  [TokenJob] Got 77 trending tokens for Base
2026-02-04T13:01:21.052762911Z [inf]  Saved 77 trending tokens for base to database and memory cache
2026-02-04T13:01:21.052772248Z [inf]  [TokenJob] Saved 77 tokens for Base to DB + cache
2026-02-04T13:01:21.077275232Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:01:21.093926651Z [err]  [Prisma-Error] 
2026-02-04T13:01:21.093936967Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:21.093945315Z [err]  
2026-02-04T13:01:21.093953393Z [err]  
2026-02-04T13:01:21.093961345Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:01:21.079Z }
2026-02-04T13:01:21.093970819Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:01:21.093979337Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:21.093987680Z [err]  
2026-02-04T13:01:21.093995671Z [err]  
2026-02-04T13:01:21.094004148Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:01:21.094013162Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:01:21.094021115Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:01:21.094029435Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:01:21.094039049Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:01:21.094047085Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:01:21.094054953Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:01:21.094104858Z [err]    code: 'P2022',
2026-02-04T13:01:21.094115005Z [err]    clientVersion: '5.22.0',
2026-02-04T13:01:21.094124938Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:01:21.094133034Z [err]  }
2026-02-04T13:01:41.087225462Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:01:41.087234203Z [err]  [Prisma-Error] 
2026-02-04T13:01:41.087241845Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:41.087249968Z [err]  
2026-02-04T13:01:41.087258714Z [err]  
2026-02-04T13:01:41.087266255Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:01:31.103Z }
2026-02-04T13:01:41.087273453Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:01:41.087281631Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:41.087289688Z [err]  
2026-02-04T13:01:41.087408748Z [err]  
2026-02-04T13:01:41.087419080Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:01:41.087426841Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:01:41.087433787Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:01:41.087442081Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:01:41.087450303Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:01:41.087457386Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:01:41.087466005Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:01:41.087474037Z [err]    code: 'P2022',
2026-02-04T13:01:41.087482101Z [err]    clientVersion: '5.22.0',
2026-02-04T13:01:41.087488850Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:01:41.087496024Z [err]  }
2026-02-04T13:01:41.170749659Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:01:41.266271969Z [err]  [Prisma-Error] 
2026-02-04T13:01:41.266283833Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:41.266293108Z [err]  
2026-02-04T13:01:41.266302376Z [err]  
2026-02-04T13:01:41.266310569Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:01:41.202Z }
2026-02-04T13:01:41.266318272Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:01:41.266325643Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:41.266332471Z [err]  
2026-02-04T13:01:41.266338886Z [err]  
2026-02-04T13:01:41.266346531Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:01:41.266353262Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:01:41.266360126Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:01:41.266366751Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:01:41.266373491Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:01:41.266379999Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:01:41.266387126Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:01:41.266393292Z [err]    code: 'P2022',
2026-02-04T13:01:41.266402959Z [err]    clientVersion: '5.22.0',
2026-02-04T13:01:41.266410499Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:01:41.266417975Z [err]  }
2026-02-04T13:01:50.980558235Z [inf]  [TokenJob] Fetching trending tokens for BSC via DexScreener Premium...
2026-02-04T13:01:50.980571097Z [inf]  Fetching premium trending tokens
2026-02-04T13:01:51.259256239Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:01:51.278894707Z [inf]  WS addresses discovered
2026-02-04T13:01:51.288663568Z [err]  [Prisma-Error] 
2026-02-04T13:01:51.288671980Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:51.288680940Z [err]  
2026-02-04T13:01:51.288689005Z [err]  
2026-02-04T13:01:51.288697897Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:01:51.278Z }
2026-02-04T13:01:51.288707367Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:01:51.288715192Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:01:51.288722962Z [err]  
2026-02-04T13:01:51.288730845Z [err]  
2026-02-04T13:01:51.288739095Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:01:51.288746965Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:01:51.288754750Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:01:51.288763943Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:01:51.288772924Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:01:51.288783340Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:01:51.288793808Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:01:51.288804863Z [err]    code: 'P2022',
2026-02-04T13:01:51.288816580Z [err]    clientVersion: '5.22.0',
2026-02-04T13:01:51.288827098Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:01:51.288839093Z [err]  }
2026-02-04T13:01:53.109388637Z [inf]  Premium trending tokens fetch complete
2026-02-04T13:01:53.109391778Z [inf]  [TokenJob] Saved 79 tokens for BSC to DB + cache
2026-02-04T13:01:53.109401648Z [inf]  [TokenJob] Got 79 trending tokens for BSC
2026-02-04T13:01:53.109401853Z [inf]  [TokenJob] Refreshed 4 primary chains in 112.6s
2026-02-04T13:01:53.109410811Z [inf]  Saved 79 trending tokens for bsc to database and memory cache
2026-02-04T13:01:53.109545696Z [inf]  Processed DexScreener trending candidates
2026-02-04T13:01:53.109556596Z [err]  Error fetching trending tokens
2026-02-04T13:02:01.284322739Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:02:01.305422986Z [err]  [Prisma-Error] 
2026-02-04T13:02:01.305439446Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:02:01.305448934Z [err]  
2026-02-04T13:02:01.305456668Z [err]  
2026-02-04T13:02:01.305465468Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:02:01.303Z }
2026-02-04T13:02:01.305475404Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:02:01.305482805Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:02:01.305491116Z [err]  
2026-02-04T13:02:01.305498907Z [err]  
2026-02-04T13:02:01.305508327Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:02:01.305517298Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:02:01.305525657Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:02:01.305534028Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:02:01.305541600Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:02:01.305549296Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:02:01.305557486Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:02:01.305565032Z [err]    code: 'P2022',
2026-02-04T13:02:01.305573267Z [err]    clientVersion: '5.22.0',
2026-02-04T13:02:01.305583285Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:02:01.305591517Z [err]  }
2026-02-04T13:02:21.306144697Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:02:21.306148895Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:02:21.306154146Z [err]  [Prisma-Error] 
2026-02-04T13:02:21.306160885Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:02:21.306165341Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:02:21.306169054Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:02:21.306176287Z [err]  
2026-02-04T13:02:21.306176354Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:02:21.306183652Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:02:21.306189969Z [err]  
2026-02-04T13:02:21.306191372Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:02:21.306199432Z [err]    code: 'P2022',
2026-02-04T13:02:21.306202705Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:02:11.327Z }
2026-02-04T13:02:21.306206767Z [err]    clientVersion: '5.22.0',
2026-02-04T13:02:21.306214335Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:02:21.306214342Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:02:21.306222261Z [err]  }
2026-02-04T13:02:21.306225784Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:02:21.306230154Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:02:21.306235757Z [err]  
2026-02-04T13:02:21.306242460Z [err]  
2026-02-04T13:02:21.306249159Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:02:21.308261719Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:02:21.308271171Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:02:21.308279335Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:02:21.308288538Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:02:21.308296640Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:02:21.361863460Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:02:21.493091134Z [err]  [Prisma-Error] 
2026-02-04T13:02:21.493101934Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:02:21.493109881Z [err]  
2026-02-04T13:02:21.493117937Z [err]  
2026-02-04T13:02:21.493125659Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:02:21.453Z }
2026-02-04T13:02:21.493134516Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:02:21.493142129Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:02:21.493152538Z [err]  
2026-02-04T13:02:21.493162969Z [err]  
2026-02-04T13:02:21.493173375Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:02:21.493183746Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:02:21.493191400Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:02:21.493198902Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:02:21.493206882Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:02:21.493216279Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:02:21.493223612Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:02:21.493231375Z [err]    code: 'P2022',
2026-02-04T13:02:21.493240785Z [err]    clientVersion: '5.22.0',
2026-02-04T13:02:21.493249018Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:02:21.493256707Z [err]  }
2026-02-04T13:02:31.493755968Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:02:31.493764418Z [err]  [Prisma-Error] 
2026-02-04T13:02:31.493772163Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:02:31.493782695Z [err]  
2026-02-04T13:02:31.493791435Z [err]  
2026-02-04T13:02:31.493799736Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:02:31.480Z }
2026-02-04T13:02:31.493808083Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:02:31.493816526Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:02:31.493824799Z [err]  
2026-02-04T13:02:31.493832423Z [err]  
2026-02-04T13:02:31.493840168Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:02:31.493848390Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:02:31.493859106Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:02:31.493866666Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:02:31.493874580Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:02:31.493882439Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:02:31.493890086Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:02:31.493897931Z [err]    code: 'P2022',
2026-02-04T13:02:31.493906313Z [err]    clientVersion: '5.22.0',
2026-02-04T13:02:31.493914783Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:02:31.493923009Z [err]  }
2026-02-04T13:02:37.750315988Z [inf]  [SocialJob] Checking Zora coin status for 248 casts...
2026-02-04T13:02:41.484075176Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:02:41.508822406Z [err]  }
2026-02-04T13:02:41.508828301Z [err]  [Prisma-Error] 
2026-02-04T13:02:41.508833364Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:02:41.508839022Z [err]  
2026-02-04T13:02:41.508843846Z [err]  
2026-02-04T13:02:41.508853466Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:02:41.505Z }
2026-02-04T13:02:41.508858036Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:02:41.508862744Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:02:41.508867896Z [err]  
2026-02-04T13:02:41.508873242Z [err]  
2026-02-04T13:02:41.508877692Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:02:41.508882559Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:02:41.508887284Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:02:41.508891913Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:02:41.508896564Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:02:41.508900958Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:02:41.508905575Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:02:41.508910712Z [err]    code: 'P2022',
2026-02-04T13:02:41.508915071Z [err]    clientVersion: '5.22.0',
2026-02-04T13:02:41.508922369Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:03:01.509799468Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:03:01.509820579Z [err]    code: 'P2022',
2026-02-04T13:03:01.509830656Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:03:01.509845569Z [err]  [Prisma-Error] 
2026-02-04T13:03:01.509851247Z [err]    clientVersion: '5.22.0',
2026-02-04T13:03:01.509864305Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:03:01.509869965Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:01.509876842Z [err]  }
2026-02-04T13:03:01.509892367Z [inf]  [SocialRepo] Cleaned up 74 old casts (cap: 1000)
2026-02-04T13:03:01.509894624Z [err]  
2026-02-04T13:03:01.509905980Z [err]  
2026-02-04T13:03:01.509914959Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:02:51.528Z }
2026-02-04T13:03:01.509923457Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:03:01.509933374Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:01.509942080Z [err]  
2026-02-04T13:03:01.509954461Z [err]  
2026-02-04T13:03:01.509963449Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:03:01.509972397Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:03:01.509980741Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:03:01.509989079Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:03:01.509998165Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:03:01.510007723Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:03:02.565853100Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:03:03.317595721Z [err]  }
2026-02-04T13:03:03.317608853Z [inf]  Timer finished: get_trending_casts_trending
2026-02-04T13:03:03.317652550Z [err]  [Prisma-Error] 
2026-02-04T13:03:03.317658424Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:03.317664647Z [err]  
2026-02-04T13:03:03.317670500Z [err]  
2026-02-04T13:03:03.317681104Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:03:02.887Z }
2026-02-04T13:03:03.317686977Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:03:03.317693664Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:03.317700590Z [err]  
2026-02-04T13:03:03.317709482Z [err]  
2026-02-04T13:03:03.317718513Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:03:03.317726870Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:03:03.317735380Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:03:03.317742494Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:03:03.317747907Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:03:03.317755563Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:03:03.317760770Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:03:03.317766900Z [err]    code: 'P2022',
2026-02-04T13:03:03.317772601Z [err]    clientVersion: '5.22.0',
2026-02-04T13:03:03.317777500Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:03:03.606993597Z [inf]  SocialRepo: Updated cache with 500 merged casts
2026-02-04T13:03:03.607000110Z [inf]  SocialRepo: Saved 248 trending casts to database
2026-02-04T13:03:03.607004978Z [inf]  Timer finished: save_trending_casts
2026-02-04T13:03:03.607010841Z [inf]  [SocialJob] Casts refreshed: 248 saved
2026-02-04T13:03:03.607015601Z [inf]  [SocialJob] 🚀 Triggering OGP Prefetch for top 50 casts...
2026-02-04T13:03:13.303616147Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:03:13.303616609Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:03:13.303627757Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:03:13.303627994Z [err]  }
2026-02-04T13:03:13.303634661Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:03:13.303640772Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:03:13.303649169Z [err]    code: 'P2022',
2026-02-04T13:03:13.303650724Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:03:12.911Z }
2026-02-04T13:03:13.303655994Z [err]    clientVersion: '5.22.0',
2026-02-04T13:03:13.303664134Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:03:13.303674407Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:13.303684460Z [err]  
2026-02-04T13:03:13.303693735Z [err]  
2026-02-04T13:03:13.303703482Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:03:13.303712152Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:03:13.303721075Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:03:13.303726837Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:03:13.303735717Z [err]  [Prisma-Error] 
2026-02-04T13:03:13.303744820Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:13.303753762Z [err]  
2026-02-04T13:03:13.303759002Z [err]  
2026-02-04T13:03:17.286911943Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:03:18.390557060Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:03:18.390565147Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:03:18.390574268Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:03:18.640822699Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:03:18.810405535Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:03:19.322687128Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:03:19.322694829Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:03:19.322700211Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:03:19.466651719Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:03:22.914982020Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:03:23.352728974Z [err]  [Prisma-Error] 
2026-02-04T13:03:23.352738139Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:23.352747909Z [err]  
2026-02-04T13:03:23.352757469Z [err]  
2026-02-04T13:03:23.352766631Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:03:22.935Z }
2026-02-04T13:03:23.352775804Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:03:23.352784916Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:23.352793522Z [err]  
2026-02-04T13:03:23.352825644Z [err]  
2026-02-04T13:03:23.352834807Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:03:23.352843314Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:03:23.352855657Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:03:23.352864486Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:03:23.352872518Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:03:23.352882082Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:03:23.352890047Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:03:23.352898301Z [err]    code: 'P2022',
2026-02-04T13:03:23.352905217Z [err]    clientVersion: '5.22.0',
2026-02-04T13:03:23.352913262Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:03:23.352923311Z [err]  }
2026-02-04T13:03:32.937652767Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:03:33.415143364Z [err]  [Prisma-Error] 
2026-02-04T13:03:33.415149954Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:33.415157410Z [err]  
2026-02-04T13:03:33.415164558Z [err]  
2026-02-04T13:03:33.415171667Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:03:32.959Z }
2026-02-04T13:03:33.415178953Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:03:33.415185582Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:33.415192059Z [err]  
2026-02-04T13:03:33.415199156Z [err]  
2026-02-04T13:03:33.415209819Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:03:33.415222897Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:03:33.415230449Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:03:33.415255671Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:03:33.415264340Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:03:33.415281320Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:03:33.415352035Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:03:33.415387483Z [err]    code: 'P2022',
2026-02-04T13:03:33.415399335Z [err]    clientVersion: '5.22.0',
2026-02-04T13:03:33.415408348Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:03:33.415419496Z [err]  }
2026-02-04T13:03:42.968180621Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:03:42.989516938Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:03:42.989531220Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:03:42.989541236Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:03:42.989551962Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:03:42.989554206Z [err]  [Prisma-Error] 
2026-02-04T13:03:42.989563452Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:03:42.989565355Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:42.989575066Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:03:42.989576931Z [err]  
2026-02-04T13:03:42.989586166Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:03:42.989587928Z [err]  
2026-02-04T13:03:42.989598124Z [err]    code: 'P2022',
2026-02-04T13:03:42.989599688Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:03:42.986Z }
2026-02-04T13:03:42.989610573Z [err]    clientVersion: '5.22.0',
2026-02-04T13:03:42.989614231Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:03:42.989622986Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:03:42.989627682Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:03:42.989634768Z [err]  }
2026-02-04T13:03:42.989641030Z [err]  
2026-02-04T13:03:42.989652171Z [err]  
2026-02-04T13:04:02.988184667Z [err]  
2026-02-04T13:04:02.988199407Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:04:02.988210247Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:04:02.988211092Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:04:02.988221417Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:04:02.988230426Z [err]  [Prisma-Error] 
2026-02-04T13:04:02.988232074Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:04:02.988245197Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:04:02.988245400Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:04:02.988255932Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:04:02.988258911Z [err]  
2026-02-04T13:04:02.988267539Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:04:02.988269673Z [err]  
2026-02-04T13:04:02.988279678Z [err]    code: 'P2022',
2026-02-04T13:04:02.988279769Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:03:53.011Z }
2026-02-04T13:04:02.988290954Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:04:02.988292321Z [err]    clientVersion: '5.22.0',
2026-02-04T13:04:02.988301927Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:04:02.988305903Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:04:02.988312374Z [err]  
2026-02-04T13:04:02.988318608Z [err]  }
2026-02-04T13:04:03.015972340Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:04:03.039269821Z [err]    code: 'P2022',
2026-02-04T13:04:03.039282000Z [err]    clientVersion: '5.22.0',
2026-02-04T13:04:03.039292193Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:04:03.039342611Z [err]  }
2026-02-04T13:04:03.039531137Z [err]  [Prisma-Error] 
2026-02-04T13:04:03.039539847Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:04:03.039548037Z [err]  
2026-02-04T13:04:03.039556312Z [err]  
2026-02-04T13:04:03.039563207Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:04:03.036Z }
2026-02-04T13:04:03.039570892Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:04:03.039578689Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:04:03.039586913Z [err]  
2026-02-04T13:04:03.039595879Z [err]  
2026-02-04T13:04:03.039604984Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:04:03.039612328Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:04:03.039620155Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:04:03.039627860Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:04:03.039636265Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:04:03.039645303Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:04:03.039652795Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:04:13.037785529Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:04:13.070344818Z [err]  [Prisma-Error] 
2026-02-04T13:04:13.070353729Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:04:13.070361809Z [err]  
2026-02-04T13:04:13.070369584Z [err]  
2026-02-04T13:04:13.070377626Z [err]  The column `Position.peakPrice` does not exist in the current database. { target: 'position.findMany', timestamp: 2026-02-04T13:04:13.061Z }
2026-02-04T13:04:13.070386775Z [err]  [PositionMonitor] Error checking positions: PrismaClientKnownRequestError: 
2026-02-04T13:04:13.070395584Z [err]  Invalid `prisma.position.findMany()` invocation:
2026-02-04T13:04:13.070403527Z [err]  
2026-02-04T13:04:13.070413344Z [err]  
2026-02-04T13:04:13.070422240Z [err]  The column `Position.peakPrice` does not exist in the current database.
2026-02-04T13:04:13.070430443Z [err]      at $n.handleRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:7315)
2026-02-04T13:04:13.070439362Z [err]      at $n.handleAndLogRequestError (/app/node_modules/@prisma/client/runtime/library.js:121:6623)
2026-02-04T13:04:13.070453388Z [err]      at $n.request (/app/node_modules/@prisma/client/runtime/library.js:121:6307)
2026-02-04T13:04:13.070462517Z [err]      at async l (/app/node_modules/@prisma/client/runtime/library.js:130:9633)
2026-02-04T13:04:13.070470872Z [err]      at async checkPositionsForExits (file:///app/dist/services/autoTradeService.js:1848:35)
2026-02-04T13:04:13.070479177Z [err]      at async Timeout.runCheck [as _onTimeout] (file:///app/dist/jobs/positionMonitorJob.js:18:9) {
2026-02-04T13:04:13.070486665Z [err]    code: 'P2022',
2026-02-04T13:04:13.070496285Z [err]    clientVersion: '5.22.0',
2026-02-04T13:04:13.070504639Z [err]    meta: { modelName: 'Position', column: 'Position.peakPrice' }
2026-02-04T13:04:13.070513612Z [err]  }
2026-02-04T13:04:20.675928908Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:04:20.675936891Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:04:20.675945101Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:04:20.801313301Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:04:20.939077108Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:04:21.098694354Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:04:21.742013318Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:04:21.742023983Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:04:23.062887854Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:04:23.643454704Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:04:23.848663931Z [inf]  ⚡ Uniswap V4 price fetched
2026-02-04T13:04:24.642023982Z [wrn]  RPC endpoint failed
2026-02-04T13:04:24.826291862Z [inf]  RPC failover success
2026-02-04T13:04:26.194126086Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:04:26.744919455Z [inf]  📊 Position P/L check
2026-02-04T13:04:36.648846172Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:04:36.648852769Z [inf]  📊 Position P/L check
2026-02-04T13:04:46.606886501Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:04:46.725844363Z [inf]  📊 Position P/L check
2026-02-04T13:05:06.330595342Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:05:06.330604750Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:05:06.330613696Z [wrn]  RPC endpoint failed
2026-02-04T13:05:06.330622654Z [inf]  RPC failover success
2026-02-04T13:05:06.330631357Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:05:06.330639108Z [inf]  SocialRepo: Recalculated heat scores for 999 casts
2026-02-04T13:05:06.330644424Z [inf]  Timer finished: recalc_heat_scores
2026-02-04T13:05:06.330649298Z [inf]  [TokenJob] Fetching trending tokens for Ethereum via DexScreener Premium...
2026-02-04T13:05:06.330654982Z [inf]  Fetching premium trending tokens
2026-02-04T13:05:06.331478352Z [inf]  [MarketJob] Trending tokens are fresh, skipping API call
2026-02-04T13:05:06.331486533Z [inf]  WS addresses discovered
2026-02-04T13:05:06.331492468Z [inf]  Processed DexScreener trending candidates
2026-02-04T13:05:08.006143366Z [inf]  Skipping low liquidity token
2026-02-04T13:05:09.766574074Z [inf]  Trending tokens fetch complete
2026-02-04T13:05:09.766582679Z [inf]  Premium trending tokens fetch complete
2026-02-04T13:05:09.766590858Z [inf]  [TokenJob] Got 100 trending tokens for Ethereum
2026-02-04T13:05:09.766600032Z [inf]  Saved 100 trending tokens for eth to database and memory cache
2026-02-04T13:05:09.871659840Z [inf]  [TokenJob] Saved 100 tokens for Ethereum to DB + cache
2026-02-04T13:05:10.769002178Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:05:30.410357958Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:05:30.410369667Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:05:30.410378214Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:05:30.410392314Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:05:30.410398015Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:05:30.410410638Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:05:30.410419479Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:05:30.410427249Z [inf]  Alpha Detector: Checking new coin
2026-02-04T13:05:31.052336971Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:05:31.776259269Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:05:33.853386007Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:05:40.272830196Z [inf]  [TokenJob] Fetching trending tokens for Solana via DexScreener Premium...
2026-02-04T13:05:40.272841878Z [inf]  Fetching premium trending tokens
2026-02-04T13:05:40.882592038Z [inf]  WS addresses discovered
2026-02-04T13:05:42.280643351Z [inf]  Processed DexScreener trending candidates
2026-02-04T13:05:42.280653288Z [inf]  Premium trending tokens fetch complete
2026-02-04T13:05:42.280661727Z [inf]  [TokenJob] Got 100 trending tokens for Solana
2026-02-04T13:05:43.017127074Z [inf]  Saved 100 trending tokens for solana to database and memory cache
2026-02-04T13:05:43.124297403Z [inf]  [TokenJob] Saved 100 tokens for Solana to DB + cache
2026-02-04T13:05:43.896754371Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:06:03.566816672Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:06:04.023976742Z [inf]  incoming request
2026-02-04T13:06:04.030756083Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_kjxdkiv6pgc2gxhs","createdAt":"2026-02-04T13:06:03.840Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed","toAddress":"0xfd50c0b0567f5a2129bb5aa65f1c26ee97152b07","blockNum":"0x27c73ac","hash":"0xb1495147d2d4e366578c33a70458bd28bd3153ff42ab7c329b1aa2d9c0e35e07","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6983443b"}],"source":"chainlake-kafka"}}
2026-02-04T13:06:04.030764252Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:06:04.030769504Z [inf]  request completed
2026-02-04T13:06:04.072379680Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0xb14951
2026-02-04T13:06:04.348268683Z [inf]  [Profile] fetchReceipt
2026-02-04T13:06:04.365518337Z [inf]  [Profile] fetchTransaction
2026-02-04T13:06:04.365529933Z [inf]  [Profile] parseSwapTransaction
2026-02-04T13:06:04.365539298Z [inf]  [Webhook] Not a swap tx for 0x2cd32fb4: 0xb1495147d2d4e3
2026-02-04T13:06:04.604000631Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:06:05.062033703Z [wrn]  0x API price returned liquidityAvailable=false
2026-02-04T13:06:06.121177165Z [inf]  incoming request
2026-02-04T13:06:06.121184295Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_x48zjyvuvmvo2abt","createdAt":"2026-02-04T13:06:05.994Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed","toAddress":"0x4409921ae43a39a11d90f7b7f96cfd0b8093d9fc","blockNum":"0x27c73ad","hash":"0x7869d48a4f86d17224ee337bbdcf6efb0cc6d0c2da692cd43180f12ad3a77da7","value":0,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x0","decimals":18},"blockTimestamp":"0x6983443d"}],"source":"chainlake-kafka"}}
2026-02-04T13:06:06.122218373Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:06:06.122225738Z [inf]  request completed
2026-02-04T13:06:06.143382445Z [inf]  [Webhook] 🎯 Found 1 tracked wallets for tx 0x7869d4
2026-02-04T13:06:06.185455987Z [inf]  [Profile] fetchReceipt
2026-02-04T13:06:06.234198577Z [inf]  [Profile] fetchTransaction
2026-02-04T13:06:06.234207976Z [inf]  [Profile] parseSwapTransaction
2026-02-04T13:06:06.234213967Z [inf]  [Webhook] ✅ Swap detected for tracked wallet 0x2cd32fb4: {
2026-02-04T13:06:06.234219201Z [inf]    tokenIn: '0x4200000000000000000000000000000000000006',
2026-02-04T13:06:06.234224538Z [inf]    tokenOut: '0xfd50c0b0567f5a2129bb5aa65f1c26ee97152b07',
2026-02-04T13:06:06.234230039Z [inf]    dex: 'Uniswap v4'
2026-02-04T13:06:06.234236753Z [inf]  }
2026-02-04T13:06:06.234244283Z [inf]  Swap detected on target wallet
2026-02-04T13:06:06.250760700Z [inf]  Target is buying - triggering copy trade
2026-02-04T13:06:06.275399263Z [inf]  incoming request
2026-02-04T13:06:06.275418603Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_w1hq8irs6q0x7n86","createdAt":"2026-02-04T13:06:06.039Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x4409921ae43a39a11d90f7b7f96cfd0b8093d9fc","toAddress":"0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed","blockNum":"0x27c73ad","hash":"0x7869d48a4f86d17224ee337bbdcf6efb0cc6d0c2da692cd43180f12ad3a77da7","value":0.000446212460884549,"typeTraceAddress":"CALL_6","asset":"ETH","category":"internal","rawContract":{"rawValue":"0x195d3ef39b245","decimals":18},"blockTimestamp":"0x6983443d"}]}}
2026-02-04T13:06:06.275428499Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:06:06.275436748Z [inf]  [Webhook] Tx already in processedTxs cache: 0x7869d48a4f86d1
2026-02-04T13:06:06.275444938Z [inf]  request completed
2026-02-04T13:06:06.406721753Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:06:06.557648972Z [inf]  incoming request
2026-02-04T13:06:06.557657551Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_j3qvq8z82ecq0f3t","createdAt":"2026-02-04T13:06:06.313Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed","toAddress":"0xd87b6f1b9fcb9deb0baf5661ffd9775ab5e94a55","blockNum":"0x27c73ad","hash":"0x7869d48a4f86d17224ee337bbdcf6efb0cc6d0c2da692cd43180f12ad3a77da7","value":633758.9705574854,"asset":"NOSOUL","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000000086342483c31922fb4f6a","address":"0xfd50c0b0567f5a2129bb5aa65f1c26ee97152b07","decimals":18},"log":{"address":"0xfd50c0b0567f5a2129bb5aa65f1c26ee97152b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000002cd32fb42748774fafde72d8607f16ccc5f5c0ed","0x000000000000000000000000d87b6f1b9fcb9deb0baf5661ffd9775ab5e94a55"],"data":"0x0000000000000000000000000000000000000000000086342483c31922fb4f6a","blockHash":"0x2c8eda55573b51807aa7c964b3a23e521c893ef2c0ac673cd200d67b1fc4d0d9","blockNumber":"0x27c73ad","blockTimestamp":"0x6983443d","transactionHash":"0x7869d48a4f86d17224ee337bbdcf6efb0cc6d0c2da692cd43180f12ad3a77da7","transactionIndex":"0xb5","logIndex":"0x57c","removed":false},"blockTimestamp":"0x6983443d"}],"source":"chainlake-kafka"}}
2026-02-04T13:06:06.557665489Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:06:06.557673810Z [inf]  [Webhook] Tx already in processedTxs cache: 0x7869d48a4f86d1
2026-02-04T13:06:06.557683262Z [inf]  request completed
2026-02-04T13:06:06.560432990Z [inf]  Timer finished: launchpad_det_0xfd50c0b0567f5a2129bb5aa65f1c26ee97152b07
2026-02-04T13:06:06.997911631Z [wrn]  RPC endpoint failed
2026-02-04T13:06:06.997924223Z [inf]  RPC failover success
2026-02-04T13:06:07.073241694Z [wrn]  RPC endpoint failed
2026-02-04T13:06:07.073250141Z [wrn]  RPC endpoint failed
2026-02-04T13:06:07.270528452Z [inf]  RPC failover success
2026-02-04T13:06:07.270537159Z [inf]  RPC failover success
2026-02-04T13:06:07.385466979Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:06:08.098939259Z [wrn]  RPC endpoint failed
2026-02-04T13:06:08.161728747Z [wrn]  RPC endpoint failed
2026-02-04T13:06:09.052902548Z [inf]  RPC failover success
2026-02-04T13:06:09.052911138Z [inf]  RPC failover success
2026-02-04T13:06:09.052919266Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:06:09.052928190Z [inf]  ✅ Hybrid fetch complete
2026-02-04T13:06:09.053645279Z [inf]  🔥 Warming up 1 user settings
2026-02-04T13:06:09.053661166Z [inf]  🔍 Batch filter complete (PARALLEL)
2026-02-04T13:06:09.053671169Z [inf]  📊 Mass Copy Trade Analysis
2026-02-04T13:06:09.053915073Z [inf]  📦 Processing batch 1/1
2026-02-04T13:06:09.205328813Z [inf]  Created PENDING position lock
2026-02-04T13:06:09.205335514Z [inf]  Buy Step 1: 100% amount, 5% slippage
2026-02-04T13:06:09.205340843Z [inf]  [MainSwapService][1770210369203_8yqrd] Starting unified swap execution
2026-02-04T13:06:09.206682111Z [inf]  Timer finished: launchpad_det_ETH
2026-02-04T13:06:09.206690689Z [inf]  [MainSwapService][1770210369203_8yqrd] Executing EVM swap
2026-02-04T13:06:09.206696869Z [inf]  [MainSwapService][1770210369203_8yqrd] FastSwapMode enabled - attempting direct swap (BUY with native)
2026-02-04T13:06:09.206702945Z [inf]  [DirectSwap] Starting direct swap
2026-02-04T13:06:09.222193624Z [inf]  [PlatformFee] Fees ENABLED: { context: 'copyTrade', bps: 100, evmRecipient: '0xc5377e6329' }
2026-02-04T13:06:09.222199417Z [inf]  [Kyber] GET routes {
2026-02-04T13:06:09.222204884Z [inf]    routesUrl: 'https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&tokenOut=0xfd50c0b0567f5a2129bb5aa65f1c26ee97152b07&amountIn=445853176268065&saveGas=true&gasInclude=true&clientId=kiko-app&origin=0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B&feeReceiver=0xc5377e6329770Be29Ef938d8aCC11f22398D7E54&feeAmount=100&isInBps=true&chargeFeeBy=currency_in'
2026-02-04T13:06:09.222210990Z [inf]  }
2026-02-04T13:06:10.096527432Z [inf]  0x API price received successfully
2026-02-04T13:06:11.222382250Z [wrn]  [DirectSwap] Reference quote timeout
2026-02-04T13:06:12.213301609Z [inf]  [DirectSwap] Reference quote from Gecko
2026-02-04T13:06:12.213314448Z [inf]  [DirectSwap] V4 fast path quote check
2026-02-04T13:06:12.213321555Z [inf]  [DirectSwap] V4 fast path accepted
2026-02-04T13:06:12.213328054Z [inf]  [DirectSwap] V4 minAmountOut calculated
2026-02-04T13:06:12.213335802Z [inf]  [DirectSwap] V4 gas estimated
2026-02-04T13:06:12.213342002Z [inf]  PrivyWallet Authorization Key config
2026-02-04T13:06:12.348402148Z [inf]  [sendTransaction] ========== PRIVY TX PARAMS ==========
2026-02-04T13:06:12.348412543Z [inf]  [sendTransaction] From: 0xFB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B
2026-02-04T13:06:12.348419446Z [inf]  [sendTransaction] To: 0x6ff5693b99212da76ad316178a184ab56d299b43
2026-02-04T13:06:12.348424991Z [inf]  [sendTransaction] Value: 445853176268065
2026-02-04T13:06:12.348431420Z [inf]  [sendTransaction] ValueHex: 0x1958048318521
2026-02-04T13:06:12.348437376Z [inf]  [sendTransaction] Data length: 2506
2026-02-04T13:06:12.348442975Z [inf]  [sendTransaction] Data (full): 0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000006983457000000000000000000000000000000000000000000000000000000000000000020b100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000400000000000000000000000006ff5693b99212da76ad316178a184ab56d299b4380000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000360000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000003060b0f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000200000000000000000000000004200000000000000000000000000000000000006000000000000000000000000fd50c0b0567f5a2129bb5aa65f1c26ee97152b07000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000001958048318521000000000000000000000000000000000000000000006fa9121adc28d39999990000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000fd50c0b0567f5a2129bb5aa65f1c26ee97152b07000000000000000000000000000000000000000000006fa9121adc28d3999999
2026-02-04T13:06:12.349825216Z [inf]  [sendTransaction] ChainId: 8453
2026-02-04T13:06:12.349831553Z [inf]  [sendTransaction] Gas: 1087708
2026-02-04T13:06:12.349836369Z [inf]  [sendTransaction] MaxFeePerGas: undefined
2026-02-04T13:06:12.349840629Z [inf]  [sendTransaction] MaxPriorityFeePerGas: undefined
2026-02-04T13:06:12.349844982Z [inf]  [sendTransaction] Full TX object: {
2026-02-04T13:06:12.349849226Z [inf]    to: '0x6ff5693b99212da76ad316178a184ab56d299b43',
2026-02-04T13:06:12.349854774Z [inf]    data: '0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000006983457000000000000000000000000000000000000000000000000000000000000000020b100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000400000000000000000000000006ff5693b99212da76ad316178a184ab56d299b4380000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000360000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000003060b0f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000200000000000000000000000004200000000000000000000000000000000000006000000000000000000000000fd50c0b0567f5a2129bb5aa65f1c26ee97152b07000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000b429d62f8f3bffb98cdb9569533ea23bf0ba28cc00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000001958048318521000000000000000000000000000000000000000000006fa9121adc28d39999990000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000004200000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000fd50c0b0567f5a2129bb5aa65f1c26ee97152b07000000000000000000000000000000000000000000006fa9121adc28d3999999',
2026-02-04T13:06:12.351171810Z [inf]    value: '445853176268065',
2026-02-04T13:06:12.351179232Z [inf]    chainId: 8453,
2026-02-04T13:06:12.351183606Z [inf]    gas: '1087708'
2026-02-04T13:06:12.351188541Z [inf]  }
2026-02-04T13:06:12.351193331Z [inf]  [sendTransaction] ===========================================
2026-02-04T13:06:13.357490067Z [inf]  [TokenJob] Fetching trending tokens for Base via DexScreener Premium...
2026-02-04T13:06:13.357500286Z [inf]  Fetching premium trending tokens
2026-02-04T13:06:14.004192895Z [inf]  WS addresses discovered
2026-02-04T13:06:14.174077132Z [inf]  Ethereum transaction sent via Privy
2026-02-04T13:06:15.145582805Z [inf]    ],
2026-02-04T13:06:15.145593009Z [inf]    sender: '0xFB64Ce8d',
2026-02-04T13:06:15.145601706Z [inf]    recipient: '0xFB64Ce8d',
2026-02-04T13:06:15.145610117Z [inf]    slippageTolerance: 1500,
2026-02-04T13:06:15.145619443Z [inf]    routeSummaryKeys: [
2026-02-04T13:06:15.145620406Z [inf]    slippageToleranceType: 'number',
2026-02-04T13:06:15.145642524Z [inf]      'tokenIn',
2026-02-04T13:06:15.145642733Z [inf]      'tokenOut',
2026-02-04T13:06:15.145658297Z [inf]      'amountIn',
2026-02-04T13:06:15.145662115Z [inf]      'amountOut',
2026-02-04T13:06:15.145671175Z [inf]      'recipient',
2026-02-04T13:06:15.145671427Z [inf]  Processed DexScreener trending candidates
2026-02-04T13:06:15.145681488Z [inf]      'amountInUsd',
2026-02-04T13:06:15.145683270Z [inf]      'amountOutUsd',
2026-02-04T13:06:15.145690586Z [inf]  [Kyber] routes response {
2026-02-04T13:06:15.145696163Z [inf]      'origin',
2026-02-04T13:06:15.145699228Z [inf]      'gas',
2026-02-04T13:06:15.145711539Z [inf]      'gasPrice'
2026-02-04T13:06:15.145719334Z [inf]    status: 200,
2026-02-04T13:06:15.145727447Z [inf]    hasData: true,
2026-02-04T13:06:15.145739776Z [inf]    keys: [ 'code', 'message', 'data', 'requestId' ]
2026-02-04T13:06:15.145746582Z [inf]    deadline: 1770210975,
2026-02-04T13:06:15.145753595Z [inf]  }
2026-02-04T13:06:15.145768253Z [inf]  [Kyber] Building route/build request body: {
2026-02-04T13:06:15.145778359Z [inf]    deadlineType: 'number',
2026-02-04T13:06:15.145781606Z [inf]    hasRouteSummary: true,
2026-02-04T13:06:15.145801310Z [inf]    allBodyKeys: [
2026-02-04T13:06:15.145816033Z [inf]      'routeSummary',
2026-02-04T13:06:15.145828412Z [inf]      'sender',
2026-02-04T13:06:15.161579104Z [inf]      'slippageTolerance',
2026-02-04T13:06:15.161587739Z [inf]      'deadline'
2026-02-04T13:06:15.161596119Z [inf]    ]
2026-02-04T13:06:15.161605266Z [inf]  }
2026-02-04T13:06:15.180233369Z [inf]  [DirectSwap] V4 swap executed
2026-02-04T13:06:15.180242450Z [inf]  [DirectSwap] Finished
2026-02-04T13:06:15.180251173Z [inf]  [MainSwapService][1770210369203_8yqrd] Direct swap successful
2026-02-04T13:06:15.214681835Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T13:06:15.238762273Z [inf]  Copy trade completed and position created
2026-02-04T13:06:15.238767784Z [inf]  [Warpcast] Sending DM to FID 877398: "🚀 Bought $NOSOUL @ $1.00
2026-02-04T13:06:15.238774888Z [inf]  
2026-02-04T13:06:15.238780282Z [inf]  🟢 **BOUGHT $NOSOUL**
2026-02-04T13:06:15.238785662Z [inf]  �..."
2026-02-04T13:06:15.513574769Z [inf]  [Warpcast] DM sent successfully. Daily usage: 1/50000
2026-02-04T13:06:15.513587198Z [inf]  ✅ Smart batch execution complete
2026-02-04T13:06:16.238256681Z [wrn]  GeckoTerminal 429 triggered backoff
2026-02-04T13:06:16.299195553Z [inf]  incoming request
2026-02-04T13:06:16.301015890Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_esyfoc5yiyi4szrc","createdAt":"2026-02-04T13:06:16.077Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","toAddress":"0x6ff5693b99212da76ad316178a184ab56d299b43","blockNum":"0x27c73b2","hash":"0x718fdee6d586eac8cc15a9d03d095c757bfbae9e5adba45688bb1994686f0f38","value":0.000445853176268065,"asset":"ETH","category":"external","rawContract":{"rawValue":"0x1958048318521","decimals":18},"blockTimestamp":"0x69834447"}],"source":"chainlake-kafka"}}
2026-02-04T13:06:16.302515912Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:06:16.326404129Z [inf]  [Webhook] ⚠️ Ignoring tx 0x718fde: No matched tracked wallets in [0xfb64, 0x6ff5]
2026-02-04T13:06:16.412989758Z [inf]  incoming request
2026-02-04T13:06:16.412995542Z [inf]  [Webhook] Incoming Alchemy (BASE_MAINNET): {"webhookId":"wh_lb0gbaogh5ek413o","id":"whevt_jt1ivyetvnxsm8yr","createdAt":"2026-02-04T13:06:16.202Z","type":"ADDRESS_ACTIVITY","event":{"network":"BASE_MAINNET","activity":[{"fromAddress":"0x498581ff718922c3f8e6a244956af099b2652b2b","toAddress":"0xfb64ce8d64cec808a8acb977d3ee7be1169f1a2b","blockNum":"0x27c73b2","hash":"0x718fdee6d586eac8cc15a9d03d095c757bfbae9e5adba45688bb1994686f0f38","value":612915.3682307692,"asset":"NOSOUL","category":"token","rawContract":{"rawValue":"0x0000000000000000000000000000000000000000000081ca356ca9167ff79c46","address":"0xfd50c0b0567f5a2129bb5aa65f1c26ee97152b07","decimals":18},"log":{"address":"0xfd50c0b0567f5a2129bb5aa65f1c26ee97152b07","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x000000000000000000000000498581ff718922c3f8e6a244956af099b2652b2b","0x000000000000000000000000fb64ce8d64cec808a8acb977d3ee7be1169f1a2b"],"data":"0x0000000000000000000000000000000000000000000081ca356ca9167ff79c46","blockHash":"0x075b04a523b019b49cc5c44633e3d82bbdfde0254ead4cb4242118458b37f8d5","blockNumber":"0x27c73b2","blockTimestamp":"0x69834447","transactionHash":"0x718fdee6d586eac8cc15a9d03d095c757bfbae9e5adba45688bb1994686f0f38","transactionIndex":"0x67","logIndex":"0x2f3","removed":false},"blockTimestamp":"0x69834447"}],"source":"chainlake-kafka"}}
2026-02-04T13:06:16.413001026Z [inf]  [Webhook] Processing as EVM activity (1 items)
2026-02-04T13:06:16.413006804Z [inf]  request completed
2026-02-04T13:06:16.430688975Z [inf]  [Webhook] ⚠️ Ignoring tx 0x718fde: No matched tracked wallets in [0x4985, 0xfb64]
2026-02-04T13:06:17.488030500Z [inf]  [PositionMonitor] 🔄 Running position check...
2026-02-04T13:06:18.042929192Z [inf]  0x API price received successfully
2026-02-04T13:06:18.343877365Z [inf]  Skipping low liquidity token
2026-02-04T13:06:18.545762312Z [err]  Error fetching trending tokens
2026-02-04T13:06:18.545767039Z [inf]  Premium trending tokens fetch complete
2026-02-04T13:06:18.545771286Z [inf]  [TokenJob] Got 73 trending tokens for Base
2026-02-04T13:06:19.048940591Z [inf]  Saved 73 trending tokens for base to database and memory cache
2026-02-04T13:06:19.048946439Z [inf]  [TokenJob] Saved 73 tokens for Base to DB + cache