const aws = require('aws-sdk')
const region = 'ap-southeast-1'
const bucketName = 'nanogbucket/nano'
const accessKeyId = "AKIA4FJWF7YCVSZJKLFE"
const secretAccessKey = "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"
const axios = require('axios');


const s3 = new aws.S3({
    region,
    accessKeyId,
    secretAccessKey,
    signatureVersion: 'v4'
})

function uploadFile(imageData, folder, userid) {
    console.log('uploadFile')
    try {
        const base64Data = new Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ""), 'base64')
        const type = imageData.split(';')[0].split('/')[1];
        const randomKey = Date.now().toString(36).substring(0, 5) + Math.random().toString(36).substr(2).substring(0, 4)

        const uploadParams = {
            Bucket: bucketName,
            Body: base64Data,
            //ACL: 'public-read',
            ContentEncoding: 'base64',
            ContentType: `image/${type}`,
            Key: `${folder}/${userid}${randomKey}.${type}`
        }
        return s3.upload(uploadParams).promise()
    } catch {
        return
    }
}


function uploadsignimage(imageData, folder, userid) {
    console.log('uploadsignimage')
    try {
        const base64Data = new Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ""), 'base64')
        const type = imageData.split(';')[0].split('/')[1];
        const randomKey = Date.now().toString(36).substring(0, 5) + Math.random().toString(36).substr(2).substring(0, 4)

        const uploadParams = {
            Bucket: bucketName,
            Body: base64Data,
            //ACL: 'public-read',
            ContentEncoding: 'base64',
            ContentType: `image/png`,
            Key: `${folder}/${userid}${randomKey}.png`
        }
        return s3.upload(uploadParams).promise()
    } catch {
        return
    }
}

function uploadPDF(base64) {
    console.log('uploadPDF')
    try {
        const base64Data = Buffer.from(base64.replace(/^data:application\/\w+;base64,/, ""), "base64");
        const randomKey = Date.now().toString(36).substring(0, 5) + Math.random().toString(36).substr(2).substring(0, 4)

        console.log(1)
        const params = {
            Bucket: bucketName,
            Key: new Date().getTime() + randomKey + ".pdf", // some uuid
            Body: base64Data,
            ContentEncoding: "base64", // required
            contentType: "application/pdf",
        };


        return s3.upload(params).promise();
    } catch {
        console.log('error')
        return
    }
}

async function uploadFile2(base64, mimeType, extension) {
    try {
      const base64Data = Buffer.from(base64.replace(/^data:application\/\w+;base64,/, ""), "base64");
  
      const randomKey = Date.now().toString(36).substring(0, 5) + Math.random().toString(36).substr(2).substring(0, 4);
      const params = {
        Bucket: bucketName,
        Key: new Date().getTime() + randomKey + extension, // Use proper extension
        Body: base64Data,
        ContentEncoding: "base64",
        ContentType: mimeType, // Correct MIME type
      };
  
      return s3.upload(params).promise(); // Upload to S3 or other service
    } catch (error) {
      console.error('Error in uploadFile:', error);
      return null;
    }
  }

// new Date().getFullYear() + (((new Date().getMonth() + 1) + '').length < 2 ? ('0' + (new Date().getMonth() + 1) ): ('' + (new Date().getMonth() + 1))) + 
// ((new Date().getDate() + '').length < 2 ? ('0' + new Date().getDate() ): ('' + new Date().getDate())) + ((new Date().getHours() + '').length < 2 ? ('0' + new Date().getHours() ): ('' + new Date().getHours())) +
// ((new Date().getMinutes() + '').length < 2 ? ('0' + new Date().getMinutes() ): ('' + new Date().getMinutes())) 


function uploadPDFSE(base64, leadid, salesid, no) {
    try {
        const base64Data = Buffer.from(base64.replace(/^data:application\/\w+;base64,/, ""), "base64");
        const randomKey = Date.now().toString(36).substring(0, 5) + Math.random().toString(36).substr(2).substring(0, 4)

        console.log(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime())

        const params = {
            Bucket: bucketName,
            Key: 'NGQ' + '-A' + no + ".pdf", // some uuid
            Body: base64Data,
            ContentEncoding: "base64", // required
            contentType: "application/pdf",
        };
        return s3.upload(params).promise();
    } catch {
        return
    }
}


//bento
function uploadbentopdf(base64, no) {
    try {
        const base64Data = Buffer.from(base64.replace(/^data:application\/\w+;base64,/, ""), "base64");
        const randomKey = Date.now().toString(36).substring(0, 5) + Math.random().toString(36).substr(2).substring(0, 4)

        console.log(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime())

        const params = {
            Bucket: bucketName,
            Key: no + ".pdf", // some uuid
            Body: base64Data,
            ContentEncoding: "base64", // required
            contentType: "application/pdf",
        };
        return s3.upload(params).promise();
    } catch {
        return
    }
}

function uploadPDFSE2(base64) {
    try {
        const base64Data = Buffer.from(base64.replace(/^data:application\/\w+;base64,/, ""), "base64");
        const randomKey = Date.now().toString(36).substring(0, 5) + Math.random().toString(36).substr(2).substring(0, 4)

        console.log(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime())

        const params = {
            Bucket: bucketName,
            Key: 'QF-' + new Date().getFullYear() + (((new Date().getMonth() + 1) + '').length < 2 ? ('0' + (new Date().getMonth() + 1)) : ('' + (new Date().getMonth() + 1))) +
                ((new Date().getDate() + '').length < 2 ? ('0' + new Date().getDate()) : ('' + new Date().getDate())) + ((new Date().getHours() + '').length < 2 ? ('0' + new Date().getHours()) : ('' + new Date().getHours())) +
                ((new Date().getMinutes() + '').length < 2 ? ('0' + new Date().getMinutes()) : ('' + new Date().getMinutes())) + ".pdf", // some uuid
            Body: base64Data,
            ContentEncoding: "base64", // required
            contentType: "application/pdf",
        };
        return s3.upload(params).promise();
    } catch {
        return
    }
}

function uploadSOF(base64, pdfname) {
    console.log('123', pdfname)
    let date = new Date().getFullYear() + (((new Date().getMonth() + 1) + '').length < 2 ? ('0' + (new Date().getMonth() + 1)) : ('' + (new Date().getMonth() + 1))) +
        ((new Date().getDate() + '').length < 2 ? ('0' + new Date().getDate()) : ('' + new Date().getDate())) + ((new Date().getHours() + '').length < 2 ? ('0' + new Date().getHours()) : ('' + new Date().getHours())) +
        ((new Date().getMinutes() + '').length < 2 ? ('0' + new Date().getMinutes()) : ('' + new Date().getMinutes())) + ((new Date().getSeconds() + '').length < 2 ? ('0' + new Date().getSeconds()) : ('' + new Date().getSeconds()))
    let temp = pdfname.split('/')
    let temp2 = [temp[0], temp[1], date].join('-')
    try {
        const base64Data = Buffer.from(base64.replace(/^data:application\/\w+;base64,/, ""), "base64");

        const params = {
            Bucket: bucketName,
            Key: temp2 + ".pdf", // some uuid
            Body: base64Data,
            ContentEncoding: "base64", // required
            contentType: "application/pdf",
        };
        return s3.upload(params).promise();
    } catch {
        conosle.log('error')
        return
    }
}

function uploadSER(base64, pdfname) {
    console.log('123', pdfname)
    let date = new Date().getFullYear() + (((new Date().getMonth() + 1) + '').length < 2 ? ('0' + (new Date().getMonth() + 1)) : ('' + (new Date().getMonth() + 1))) +
        ((new Date().getDate() + '').length < 2 ? ('0' + new Date().getDate()) : ('' + new Date().getDate())) + ((new Date().getHours() + '').length < 2 ? ('0' + new Date().getHours()) : ('' + new Date().getHours())) +
        ((new Date().getMinutes() + '').length < 2 ? ('0' + new Date().getMinutes()) : ('' + new Date().getMinutes())) + ((new Date().getSeconds() + '').length < 2 ? ('0' + new Date().getSeconds()) : ('' + new Date().getSeconds()))
    let temp = pdfname.split('/')
    let temp2 = [temp[0], temp[1], date].join('-')
    try {
        const base64Data = Buffer.from(base64.replace(/^data:application\/\w+;base64,/, ""), "base64");

        const params = {
            Bucket: bucketName,
            Key: temp2 + ".pdf", // some uuid
            Body: base64Data,
            ContentEncoding: "base64", // required
            contentType: "application/pdf",
        };
        return s3.upload(params).promise();
    } catch {
        conosle.log('error')
        return
    }
}

function uploadPDFReceipt(base64) {
    try {
        const base64Data = Buffer.from(base64.replace(/^data:application\/\w+;base64,/, ""), "base64");
        const randomKey = Date.now().toString(36).substring(0, 5) + Math.random().toString(36).substr(2).substring(0, 4)

        console.log(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime())

        const params = {
            Bucket: bucketName,
            Key: 'Receipt-' + new Date().getFullYear() + (((new Date().getMonth() + 1) + '').length < 2 ? ('0' + (new Date().getMonth() + 1)) : ('' + (new Date().getMonth() + 1))) +
                ((new Date().getDate() + '').length < 2 ? ('0' + new Date().getDate()) : ('' + new Date().getDate())) + ((new Date().getHours() + '').length < 2 ? ('0' + new Date().getHours()) : ('' + new Date().getHours())) +
                ((new Date().getMinutes() + '').length < 2 ? ('0' + new Date().getMinutes()) : ('' + new Date().getMinutes())) + ((new Date().getSeconds() + '').length < 2 ? ('0' + new Date().getSeconds()) : ('' + new Date().getSeconds())) + "-" + randomKey + ".pdf", // some uuid
            Body: base64Data,
            ContentEncoding: "base64", // required
            contentType: "application/pdf",
        };
        return s3.upload(params).promise();
    } catch {
        return
    }
}

function uploadPDFReceipt2(base64, name) {
    try {
        const base64Data = Buffer.from(base64.replace(/^data:application\/\w+;base64,/, ""), "base64");
        const randomKey = Date.now().toString(36).substring(0, 5) + Math.random().toString(36).substr(2).substring(0, 4)

        console.log(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime())

        const params = {
            Bucket: bucketName,
            Key: name + ".pdf", // some uuid
            Body: base64Data,
            ContentEncoding: "base64", // required
            contentType: "application/pdf",
        };
        return s3.upload(params).promise();
    } catch {
        return
    }
}

async function downloadImg(imageUrl) {
    try {
        // Download the image from the specified URL
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

        // Return the image data
        return response.data;
    } catch (error) {
        console.error('Error downloading image:', error);
        throw error; // Rethrow the error to handle it in the caller function
    }
}

module.exports = { uploadFile, uploadPDF,uploadFile2, uploadPDFSE, uploadSOF, uploadPDFReceipt, uploadPDFReceipt2, uploadPDFSE2, uploadsignimage, uploadbentopdf, uploadSER, downloadImg };
