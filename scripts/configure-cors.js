require("dotenv").config();
const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");

const client = new S3Client({ 
  region: process.env.AWS_REGION || "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const params = {
  Bucket: process.env.AWS_S3_BUCKET || "hotstock-bucket",
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedHeaders: ["*"],
        AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
        AllowedOrigins: [
          "http://localhost:3000",
          "http://localhost:3001",
          "https://hotstock.vn",
          "https://admin.hotstock.vn"
        ],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3000
      }
    ]
  }
};

const run = async () => {
  try {
    const data = await client.send(new PutBucketCorsCommand(params));
    console.log("✅ Cấu hình CORS thành công cho S3 Bucket!");
  } catch (err) {
    console.error("❌ Lỗi khi cấu hình CORS:", err);
  }
};

run();
