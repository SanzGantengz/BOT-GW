const fetch = require('node-fetch')
const FormData = require('form-data')
const FileType = require('file-type')

const uploadImage = (buffer) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { ext } = await FileType.fromBuffer(buffer)
            let form = new FormData()
            form.append('file', buffer, 'tmp.' + ext)
            let res = await fetch('https://telegra.ph/upload', {
                method: 'POST',
                body: form
            })
            let img = await res.json()
            if (img.error) reject(img.error)
            else resolve('https://telegra.ph' + img[0].src)
        } catch (e) {
            reject(e)
        }
    })
}


module.exports = {
   uploadImage
}
