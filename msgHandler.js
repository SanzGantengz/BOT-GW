const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const yts = require('yt-search')
const { spawn } = require('child_process')

const { color, bgColor } = require('./lib/color')
const config = require('./config.json')


const msg = {
    wait: `_Tunggu sebentar sedang diprosess..._`,
    error: `_*[❗] Terjadi kesalahan mungkin disebabkan oleh system*_`,
    notCmd: (usedPrefix, cmd) => `command *${usedPrefix + cmd}* Tidak terdaftar!!!`
}



module.exports = msgHandler = async(m, client) => {
  try {
    if (m.text && typeof m.text !== 'string') return
    if (m.isBaileys) return
    if (!m.message) return
    let { quoted, mentionedJid, sender, isGroup, text, pushname } = m
    //Group
    const groupMetadata = isGroup ? await client.groupMetadata(m.chat) : {}
    const groupMember =  isGroup ? groupMetadata.participants.map(v=>v.jid) : []
    const groupAdmin = isGroup ? groupMetadata.participants.filter(u => u.isAdmin || u.isSuperAdmin).map(v=>v.jid) : []
   
    const isAdmin = groupAdmin.includes(sender)
    const isOwner = config.owner.includes(sender)
    
    //BOT PREFIX
    let prefix = new RegExp('^[' + config.prefix + ']') 
    let usedPrefix = prefix.exec((text || ''))
    let noPrefix = text.replace(usedPrefix, '')
    let isCommand = prefix.test(text)
    m.isCommand = isCommand
    let [command, ...args] = noPrefix.trim().split(' ').filter(u=>u)
    let body = args.join(' ')
    command = (command || '').toLowerCase()
    
    
    switch (command) {
      case 'sticker':
        try {
         let mtype = (quoted ? quoted : m).mtype
         if (mtype !== 'videoMessage' && mtype !== 'imageMessage') throw `[❗] Tag video/image yang akan dijadikan sticker`
         m.reply(msg.wait)
         const mediaData = await (quoted ? quoted : m).download()
         client.sendFile(m.chat, mediaData, 'sticker.webp', null, m, {asSticker: true})
        }catch(e) {
          _err(e)
        }
        break
      case 'toimg':
        try {
          if (!m.quoted && m.quoted.mtype != 'stickerMessage') throw '[❗]Tag stikernya!'
          let q = { message: { [m.quoted.mtype]: m.quoted }}
          if (/sticker/.test(m.quoted.mtype) && !q.message.stickerMessage.isAnimated) {
          let sticker = await client.downloadM(q)
          if (!sticker) throw sticker
          let tmp = path.join(__dirname, './tmp/' + (new Date * 1) + '.webp')
          let out = tmp.replace(/webp$/, 'png')
          fs.writeFileSync(tmp, sticker)
          spawn('ffmpeg', 
             ['-i', tmp, out])
             .on('error', () => client.reply('Terjadi kesalahan!'))
             .on('error', () => fs.unlinkSync(tmp))
             .on('exit',async () => {
                  await client.sendFile(m.chat, out, 'image.png', '', m)
                  fs.unlinkSync(tmp)
                  if (fs.existsSync(out)) fs.unlinkSync(out)
              })
          }else throw '[❗]Tag sticker yang akan di jadikan image!'
        }catch(e) {
          _err(e)
        }
        break
      case 'ssweb':
        try {
          if (!args[0]) return client.reply(m.chat, `Example: ${usedPrefix + command} https://google.com`, m)
          let url = /https?:\/\//.test(args[0]) ? args[0] : 'https://' + args[0]
          client.sendFile(m.chat, 'https://rrull-api.herokuapp.com/api/ssweb?url=' + url, 'screenshot.png', url, m)
        }catch(e){
          _err(e)
        }
        break
      case 'play':
        try {
          if (!args[0]) throw `[❗] Example: ${usedPrefix + command} yakusoku`
          m.reply(msg.wait)
          const data = (await yts(body)).all.filter(v => v.type == 'video' && v.seconds <= 400)[0]
          let caption = `*Title:* ${monospace(data.title)}\n`
          + `*Durasi:* ${monospace(data.timestamp)}\n`
          + `*Views:* ${monospace(data.views)}\n`
          + `*Channel:* ${monospace((data.author.name ?? 'Unknown'))}\n`
          + `*Uploaded:* ${monospace(data.ago)}\n`
          client.sendFile(m.chat, data.image, 'ini.png', caption, m)
          const hehe = await (await fetch(`https://api-rull.herokuapp.com/api/yt/yta?url=${data.url}`)).json()
          client.sendFile(m.chat, hehe.result, `${data.title}.mp3`, null, m)
        }catch(e){
          _err(e)
        }
        break

      default:
         if(isCommand) m.reply(msg.notCmd(usedPrefix, command))
    }
    
    






    function _err(e) {
      if (typeof e == 'string')
        client.reply(m.chat, e, m)
      else
        client.reply(m.chat, msg.error, m)
        console.log(color('[ERROR]','red'), e)
    }
    
    function monospace(s) {
      let _3 = '`'.repeat(3)
      return _3 + s + _3
    }
    
    
  }catch(err) {
    console.log(color('[ERROR]','red'), err)
  }
}
