const fs = require('fs')
const util = require('util')
const path = require('path')
const FileType = require('file-type')
const fetch = require('node-fetch')
const { spawn } = require('child_process')
const { MessageType, Mimetype } = require('@adiwajshing/baileys')
const ffmpeg = require('fluent-ffmpeg')



exports.WAConnection = (_WAConnection) => {
	class WAConnection extends _WAConnection {
		constructor(...args) {
		  super(...args)
		  
	    this.on('message-new', m => {
         let type = m.messageStubType 
	       let participants = m.messageStubParameters
	       switch (type) {
	         case 27: 
	         case 31: 
	           this.emit('group-add', { m, type, participants })
	           break
	         case 28: 
	         case 32:
	           this.emit('group-leave', { m, type, participants })
	           break 
	         case 40: 
	         case 41:
	         case 45: 
	         case 46: 
	            this.emit('call', { type, participants,
	               isGroup: type == 45 || type == 46,
	               isVideo: type == 41 || type == 46
	            })
	            break
	       }
     })
	       
	   if (!Array.isArray(this._events['CB:action,add:relay,message'])) this._events['CB:action,add:relay,message'] = [this._events['CB:action,add:relay,message']] 
	   else this._events['CB:action,add:relay,message'] = [this._events['CB:action,add:relay,message'].pop()]
	   this._events['CB:action,add:relay,message'].unshift(async function (json) {
	     try { 
	       let m = json[2][0][2]
	       if (m.message && m.message.protocolMessage && m.message.protocolMessage.type == 0) {
	         let key = m.message.protocolMessage.key 
	         let c = this.chats.get(key.remoteJid)
	         let a = c.messages.dict[`${key.id}|${key.fromMe ? 1 : 0}`] 
	         let participant = key.fromMe ? this.user.jid : a.participant ? a.participant : key.remoteJid 
	         let WAMSG = a.constructor 
	         this.emit('message-delete', { key, participant, message: WAMSG.fromObject(WAMSG.toObject(a)) }) } 
	     } catch (e) { }
	   })	 
	  

	 }
	 
    async waitEvent(eventName) {
      return await (new Promise(resolve => this.once(eventName, resolve)))
    }

    async sendFile(jid, path, filename = '', caption = '', quoted, options = {}) {
    	let file = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await fetch(path)).buffer() : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
  	  const type = await FileType.fromBuffer(file) || { mime: 'application/octet-stream', ext: '.bin' }
      if (!type) {
        options.asDocument = true
      }
  	  let mtype = ''
    	let opt = { filename, caption }
  	  if (options.asGif) {
  	    delete options.asGif
  	    if (/image\/gif/.test(type.mime)) file = await parseGif(file, type.ext)
  	    opt.mimetype = Mimetype.gif
        mtype = MessageType.video
    	} else if (options.asSticker) {
        if (!/webp/.test(type.ext)) file = await toSticker(file, type.ext)
        delete opt.caption
       	mtype = MessageType.sticker
        delete options.asSticker
      } else if (!options.asDocument) {
        if (/audio/.test(type.mime)) file = await (options.ptt ? toPTT : toAudio)(file, type.ext)
        else if (/video/.test(type.mime)) file = await toVideo(file, type.ext)
        if (/image/.test(type.mime)) mtype = MessageType.image
        else if (/video/.test(type.mime)) mtype = MessageType.video
        else delete opt.caption 
        if (/audio/.test(type.mime)) {
            mtype = MessageType.audio
            opt.mimetype = Mimetype.mp4audio
        }
        delete options.asDocument
      } else {
        mtype = MessageType.document
        opt.mimetype = type.mime
      }
      if (options.thumbnail && mtype == MessageType.audio) delete options.thumbnail
      if (quoted) opt.quoted = quoted
  		return await this.sendMessage(jid, file, mtype, {...opt, ...options})
    }

    reply(jid, text, quoted, options) {
  	  return this.sendMessage(jid, text, MessageType.extendedText, { quoted, ...options })
    }
	
	  fakeReply(jid, text = '', fakeJid = this.user.jid, fakeText = '', fakeGroupJid) {
    	return this.reply(jid, text, { key: { fromMe: fakeJid == this.user.jid, participant: fakeJid, ...(fakeGroupJid ? { remoteJid: fakeGroupJid } : {}), id: '' }, message: { conversation: fakeText }})
    }

    parseMention(text) {
      return [...text.matchAll(/@(\d{5,16})/g)].map(v => v[1] + '@s.whatsapp.net')
    }

  	getName(jid)  {
    	let v = jid === this.user.jid ? this.user : this.contacts[jid] || { notify: jid.replace(/@.+/, '') }
    	return v.notify || v.vname || v.name
    }
  
    sendText(jid, text = '') {
      return this.sendMessage(jid, text, MessageType.text)
    }
  
    async downloadM(m, save) {
      if (!m) return Buffer.alloc(0)
      if (!m.message) return Buffer.alloc(0)
  	  if (!m.message[Object.keys(m.message)[0]].url) await this.updateMediaMessage(m)
	    if (save) return await this.downloadAndSaveMediaMessage(m)
      return await this.downloadMediaMessage(m)
    }
 }

  return WAConnection
}

exports.smsg = (client, m, hasParent) => {
  if (!m) return m
	if (m.key) {
		m.id = m.key.id
    m.isBaileys = m.id.startsWith('3EB0') && m.id.length === 12
		m.chat = m.key.remoteJid
		m.fromMe = m.key.fromMe
		m.isGroup = m.chat.endsWith('@g.us')
		m.sender = m.fromMe ? client.user.jid : m.isGroup ? m.participant : m.chat
		m.pushname = client.getName(m.sender)
    m.download = async() => {
      return await client.downloadM(m)
    }
	}
	if (m.message) {
		m.mtype = Object.keys(m.message)[0]
		m.msg = m.message[m.mtype]
		if (m.mtype === 'ephemeralMessage') {
			exports.smsg(client, m.msg)
			m.mtype = m.msg.mtype
			m.msg = m.msg.msg
		}
		m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null
		m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []
		if (m.quoted) {
		  let type = Object.keys(m.quoted)[0]
			m.quoted = m.quoted[type]
      if (typeof m.quoted == 'string') m.quoted = { text: m.quoted }
			m.quoted.mtype = type
			m.quoted.id = m.msg.contextInfo.stanzaId
      m.quoted.isBaileys = m.quoted.id.startsWith('3EB0') && m.quoted.id.length === 12
			m.quoted.sender = m.msg.contextInfo.participant
		  m.quoted.fromMe = m.quoted.sender == client.user.jid
			m.quoted.text = m.quoted.text || m.quoted.caption || ''
			m.quoted.download = async() => {
			  return await client.downloadM({ message: { [m.quoted.mtype]: m.quoted } })
			}
		}
		m.text = m.msg.text || m.msg.caption || m.msg || ''
    m.reply = (text, chatId, options) => client.reply(chatId ? chatId : m.chat, text, m,  options)
	}
}

exports.logic = (check, inp, out) => {
	if (inp.length !== out.length) throw new Error('Input and Output must have same length')
	for (let i in inp) if (util.isDeepStrictEqual(check, inp[i])) return out[i]
	return null
}

function toAudio(buffer, ext) {
  return new Promise((resolve, reject) => {
    let tmp = path.join(__dirname, '../tmp', (new Date * 1) + '.' + ext)
    let out = tmp.replace(new RegExp(ext + '$'), 'mp3')
    fs.writeFileSync(tmp, buffer)
    spawn('ffmpeg', [
      '-y',
      '-i',tmp,
      '-vn',
      '-c:a','aac',
      '-b:a','128k',
      '-ar','44100',
      '-f', 'mp3',
      out
    ])
    .on('error', reject)
    .on('error', () => fs.unlinkSync(tmp))
    .on('close', () => {
      console.log('[FFMPEG] DONE');
      resolve(fs.readFileSync(out))
      fs.unlinkSync(tmp)
      if (fs.existsSync(out)) fs.unlinkSync(out)
    })
  })
}

function toPTT(buffer, ext) {
  return new Promise((resolve, reject) => {
    let tmp = path.join(__dirname, '../tmp', (new Date * 1) + '.' + ext)
    let out = tmp.replace(new RegExp(ext + '$'), 'opus')
    fs.writeFileSync(tmp, buffer)
    spawn('ffmpeg', [
      '-y',
      '-i',tmp,
      '-vn',
      '-c:a','libopus',
      '-b:a','128k',
      '-vbr','on',
      '-compression_level','10',
      out,
    ])
    .on('error', reject)
    .on('error', () => fs.unlinkSync(tmp))
    .on('close', () => {
      resolve(fs.readFileSync(out))
      fs.unlinkSync(tmp)
      if (fs.existsSync(out)) fs.unlinkSync(out)
    })
  })
}

function toVideo(buffer, ext) {
  return new Promise((resolve, reject) => {
    let tmp = path.join(__dirname, '../tmp', (new Date * 1) + '.' + ext)
    let out = tmp.replace(new RegExp(ext + '$'), 'mp4')
    fs.writeFileSync(tmp, buffer)
    spawn('ffmpeg', [
      '-y',
      '-i',tmp,
      '-c:v','libx264',
      '-c:a','aac',
      '-ab','192k',
      '-ar','44100',
      out
    ])
    .on('error', reject)
    .on('error', () => fs.unlinkSync(tmp))
    .on('close', () => {
      resolve(fs.readFileSync(out))
      fs.unlinkSync(tmp)
      if (fs.existsSync(out)) fs.unlinkSync(out)
    })
  })
}



function parseGif(buffer, ext) {
  return new Promise((resolve, reject) => {
     let tmp = path.join(__dirname, '../tmp', (1 * new Date) + '.' + ext)
     let out = tmp.replace(new RegExp(ext + '$'), 'mp4')
     fs.writeFileSync(tmp, buffer)
     ffmpeg(tmp)
      .outputOptions([ 
        '-movflags faststart', 
        '-pix_fmt yuv420p', 
        '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2' 
       ])
       .inputFormat(ext)
       .on('error', reject)
       .on('error',() => fs.unlinkSync(tmp))
       .on('end', () => {
          resolve(fs.readFileSync(out))
          fs.unlinkSync(tmp)
          if (fs.existsSync(out)) fs.unlinkSync(out)
          })
       .save(out)
  })
}


function toSticker(buffer, ext) {
  let tmp = path.join(__dirname, '../tmp' + (new Date * 1) + '.' + ext)
  let out = tmp.replace(new RegExp(ext + '$'), 'webp')
  return new Promise(resolve, reject => {
  fs.writeFileSync(tmp, buffer)
  spawn('ffmpeg',[
    '-y',
    '-i', tmp,
    `-vcodec`,`libwebp`,
    `-vf`,`scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`,
    '-f', 'webp',
    out])
    .on('error', reject)
    .on('error', () => fs.unlinkSync(tmp))
    .on('exit',() => {
      resolve(fs.readFileSync(out))
      fs.unlinkSync(tmp)
      if (fs.existsSync(out)) fs.unlinkSync(out)
    })
  })
  
}
