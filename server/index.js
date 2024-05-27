const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));
const port = 5000;

app.use(express.json());

let dataCache = []; 
let subscriptionPricesCache = []; 

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  const { basePrice, pricePerCreditLine, pricePerCreditScorePoint } = req.body;

  if (!file) {
    return res.status(400).send({ message: 'No file uploaded' });
  }

  if (!basePrice || !pricePerCreditLine || !pricePerCreditScorePoint) {
    return res.status(400).send({ message: 'Pricing parameters are missing' });
  }

  dataCache = [];
  subscriptionPricesCache = [];

  fs.createReadStream(file.path)
    .pipe(csv())
    .on('data', (data) => {
      const { CreditScore, CreditLines } = data;
      const subscriptionPrice = calculateSubscriptionPrice(CreditScore, CreditLines, basePrice, pricePerCreditLine, pricePerCreditScorePoint);
      subscriptionPricesCache.push(subscriptionPrice);
      dataCache.push(data);
    })
    .on('end', () => {
      fs.unlinkSync(file.path);
      res.status(200).send({ message: 'File uploaded and processed successfully' });
    })
    .on('error', (error) => {
      console.error(error);
      res.status(500).send({ message: 'Error processing file' });
    });
});

app.get('/data', (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 100;
  const offset = (page - 1) * limit;
  const data = dataCache.slice(offset, offset + limit);
  const subscriptionPrices = subscriptionPricesCache.slice(offset, offset + limit);
  const totalPages = Math.ceil(dataCache.length / limit);

  res.send({ data, subscriptionPrices, totalPages });
});

function calculateSubscriptionPrice(creditScore, creditLines, basePrice, pricePerCreditLine, pricePerCreditScorePoint) {
  return parseFloat(basePrice) + (parseFloat(pricePerCreditLine) * creditLines) + (parseFloat(pricePerCreditScorePoint) * creditScore);
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
