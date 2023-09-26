const express = require("express");
const cors = require("cors");
const axios = require('axios');
const fs = require('fs');
const WaveFile = require('wavefile').WaveFile;
const multer = require('multer');
const morgan = require('morgan');
// const fetch = require('node-fetch');
const path = require('path');
const ytdl = require('ytdl-core');
const cheerio = require('cheerio');
const { getLyrics, getSong } = require('genius-lyrics-api');

// Create Express app
const app = express();
app.use(cors());
app.use(morgan("common"));
app.use(express.json());



// get mp3 file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    // cb(null, file.fieldname + '-' + Date.now() + '.mp3')
    cb(null, 'temp.mp3')
  }
})

const upload = multer({ storage: storage })

app.post('/upload', upload.single('myFile'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('No file uploaded.');
  }
  // res.send('File uploaded successfully.');

  const data = {
    'api_token': '6163a9a96f55254b1e31b9bbd7f33165',
    'file': fs.createReadStream('./uploads/temp.mp3'),
    'return': 'apple_music,spotify',
  };

  const re = await axios({
    method: 'post',
    url: 'https://api.audd.io/',
    data: data,
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  let myresult = {};
  console.log(re.data);
  if (re.data.result != null) {
    await axios.get(re.data.result.song_link)
      .then(response => {
        const html = response.data;
        const $ = cheerio.load(html);

        // Find the <img> element
        const img = $('img');
        console.log(img.attr('src'));

        myresult.image = img.attr('src');
      })
      .catch(console.error);
    myresult.artist = re.data.result.artist
    myresult.title = re.data.result.title

    myresult.album = re.data.result.album
    myresult.song_link = re.data.result.song_link
    if (Object.keys(re.data.result).includes('apple_music')) {
      myresult.composerName = re.data.result.apple_music.composerName;
      const options = {
        apiKey: 'nP4woRpAPQQZ4OIDD80RvwiTsky34EjuvVPvX9c4_ZJPxH-TweCl0g3A61E5HXAA',
        title: myresult.title,
        artist: myresult.artist,
        optimizeQuery: true
      };

      await getLyrics(options).then((lyrics) => {
        myresult.lyrics = lyrics;
        console.log(lyrics);
      });

      await getSong(options).then((song) =>
        console.log(`${song.id} - ${song.title} - ${song.url} - ${song.albumArt} - ${song.lyrics}`)
      );
    } else {
      myresult.lyrics = "This isn't a song, so you can't find out the lyrics"
    }

    console.log(re.data.result);
    res.send(myresult);

  }else{
    res.send(re.data.result )
  }

})



const shazamAPI = async (req, res) => {
  try {
    const filePath = 'Windows Ringin.wav';

    // Read the WAV file from the local filesystem
    const buffer = fs.readFileSync(filePath);

    // Create a new instance of WaveFile
    const wav = new WaveFile();
    // Reformat recording for API
    wav.fromBuffer(buffer);
    wav.toSampleRate(44100);
    const wavBuffer = wav.toBuffer();
    const base64String = new Buffer.from(wavBuffer).toString('base64');

    // shazam API
    const options = {
      method: 'POST',
      url: 'https://shazam.p.rapidapi.com/songs/v2/detect',
      headers: {
        'content-type': 'text/plain',
        'X-RapidAPI-Key': '5fd48d7c80msha5bfdd6f7d40dc6p14c22djsn559ed0d04a8d',
        'X-RapidAPI-Host': 'shazam.p.rapidapi.com'
      },
      data: base64String,
    };

    const response = await axios.request(options).then(
      res => {
        console.log(res.data)
        console.log('success',);
        // res.status('400').send({ message: 'success' });
      }
    ).catch(function (error) {
      console.error(error);
    });
    // console.log(resp);

  } catch (error) {
    console.error("shazam API error", error);
  }

}

app.get('/download-youtube-video', async (req, res) => {
  try {
    const youtubeVideoUrl = req.query.url;
    console.log('working')
    // const videoUrl = 'https://www.youtube.com/watch?v=G33j5Qi4rE8';
    console.log(youtubeVideoUrl)

    const info = await ytdl.getInfo(youtubeVideoUrl);
    // console.log('info: ', info)
    const videoFormat = ytdl.chooseFormat(info.formats, { quality: 18 });
    const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, ''); // Remove special characters from the title
    // console.log('videoFormat: ', videoFormat)
    ytdl(youtubeVideoUrl, { format: videoFormat })
      .pipe(fs.createWriteStream(`uploads/${videoTitle}.mp4`))
      .on('finish', () => {
        res.send(`${videoTitle}.mp4`)
        console.log('Video downloaded successfully!');
      })
      .on('error', (error) => {
        console.error('Error downloading video:', error);
      });

    res.header('Content-Disposition', `attachment; filename="${info.videoDetails.title}.mp4"`);
    // ytdl(videoFormat.url).pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while downloading the YouTube video.');
  }
});



app.get("/file/:filename", async (req, res) => {
  const filePath = path.join(
    __dirname,
    `uploads/${req.params.filename}`
  );
  res.sendFile(filePath);
});



// app.get('/download-tiktok-video', async (req, res) => {
//   try {
//     const tiktokVideoUrl = req.query.url;
//     const response = await fetch(tiktokVideoUrl);
//     const videoBuffer = await response.buffer();

//     res.setHeader('Content-Disposition', 'attachment; filename="tiktok_video.mp4"');
//     res.setHeader('Content-Type', 'video/mp4');
//     res.send(videoBuffer);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('An error occurred while downloading the TikTok video.');
//   }
// });


// Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
