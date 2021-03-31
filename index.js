const {
  WAConnection: _WAConnection
} = require('@adiwajshing/baileys')
const fs = require('fs')
const syntaxErr = require('syntax-error')
const simple = require('./lib/simple')
const WAConnection = simple.WAConnection(_WAConnection)
const client = new WAConnection()

require('./config.json')
nocache('./config.json', module => console.log(`${module} is now updated!`))
require('./msgHandler.js')
nocache('./msgHandler.js', module => console.log(`${module} is now updated!`))



async function start() {
  client.on('qr', () => console.log('[❗] Scan code qr diatas'))
  let authFile = './anu-bot.session.json'
  if (fs.existsSync(authFile)) client.loadAuthInfo(authFile)
  client.on('credentials-updated', fs.writeFileSync(authFile, JSON.stringify(client.base64EncodedAuthInfo(), null, 2)))
  await client.connect()
  client.on('message-new', (m) => {
    simple.smsg(client, m)
    require('./msgHandler.js')(m, client)

  })
  client.on('close', () => {
    setTimeout(async () => {
      try {
        if (client.state === 'close') {
          await client.loadAuthInfo(authFile)
          await client.connect()
          console.log('BANGKIT DARI KUBUR :V')
        }
      } catch (e) {
        console.log('ERROR, when trying to reconnect', e)
      }
    },
      5000)
  })

}


process.on('uncaughtException', console.error)

function nocache(module, cb = () => {}) {
  fs.watchFile(require.resolve(module), async () => {
    let err = syntaxErr(fs.readFileSync(module))
    if (err) console.error(`Syntax Error while loading \'${module}\'\n`, err)
    else {
      await uncache(require.resolve(module)) 
      cb(module)
    }
  })
} 

function uncache(module = '.js') {
  return new Promise((resolve, reject) => {
    try {
      delete require.cache[require.resolve(module)] 
      resolve()
    } catch (e) {
      reject(e)
    }
  })
  
}





start().catch(console.error)
