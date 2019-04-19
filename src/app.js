import express from "express";
import bodyParser from "body-parser";
import ElasticSearchRouter from "./routes/esrouter";

import cors from 'cors';
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const auth = require("./auth/auth");

const app = express();
const port = process.env.PORT || 3000;
const user_model = mongoose.model("user_model");

require('dotenv').config();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({
    'allowedHeaders': ['sessionId', 'Content-Type'],
    'exposedHeaders': ['sessionId'],
    'origin': '*',
    'methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
    'preflightContinue': false
  }));

app.post("/setup", auth.addUser);
app.delete("/removeUser/:name", auth.deleteUser);
app.post("/authenticate", auth.authneticate);

// TODO: route middleware to verify a token
app.use((req, res, next) => {
  var token =
    req.body.token || req.query.token || req.headers["x-access-token"];

  // decode token
  if (token) {
    // verifies secret and checks exp
    jwt.verify(token, process.env.SUPER_SECRET, (err, decoded) => {
      if (err) {
        return res.json({
          success: false,
          message: "Failed to authenticate token."
        });
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;
        next();
      }
    });
  } else {
    // if there is no token return an error
    return res.status(403).send({
      success: false,
      message: "No token provided."
    });
  }
});

app.use("/elasticsearch", ElasticSearchRouter);

app.listen(port);

//for testing we need to export app
module.exports = app;
