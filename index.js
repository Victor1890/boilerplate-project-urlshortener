require('dotenv').config();
const express = require('express');
const dns = require('dns');
const cors = require('cors');
const app = express();
const mongoose = require('mongoose');

// Basic Configuration
const port = process.env.PORT || 4000;
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
});

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true });

const { Schema } = mongoose;

const urlSchema = new Schema({
    original_url: {
        type: String,
        required: true
    },
    short_url: {
        type: Number,
        required: true,
        default: 0
    }
});

const Url = mongoose.model('Url', urlSchema);

const cache = {};

app.post("/api/shorturl", async (req, res) => {

    let url = req.body.url;

    if (!url) return res.json({ error: 'invalid URL' });

    const hostname = url.replace(/http[s]?\:\/\//, '').replace(/\/(.+)?/, '');

    return dns.lookup(hostname, async (error, addresses) => {

        if (error) console.log({ error });

        if (!addresses) return res.json({ error: 'invalid URL' });

        return Url.findOne({ original_url: url }).then((data) => {

            if (data) return res.json({ original_url: data.original_url, short_url: data.short_url });

            return Url.estimatedDocumentCount().then((count) => {

                const url = new Url({
                    original_url: req.body.url,
                    count: count + 1
                })

                return url.save().then(data => {
                    return res.json({
                        original_url: data.original_url,
                        short_url: data.count
                    });
                });
            });
        }).catch(error => {
            console.log({ error })
            return res.send('estimatedDocumentCount() error');
        });
    });
});

app.get('/api/shorturl/:shorturl', (req, res) => {

    const { shorturl } = req.params;

    const regex = /^\d+$/;

    if (!regex.test(shorturl)) return res.json({ error: 'no matching URL' });;

    return Url.findOne({ short_url: shorturl }).then((urlFound) => {

        // if (err) console.log('findOne() error');

        if (!urlFound) return res.json({ error: 'no matching URL' });

        return res.redirect(urlFound.original_url);
    }).catch(error => {
        console.log({ error })
        return res.json({ error: 'no matching URL' });
    })
});

app.listen(port, function () {
    console.log(`Listening on port ${port}`);
});
