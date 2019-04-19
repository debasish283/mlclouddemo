import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import db from "../models/user_model";
const user_model = mongoose.model("user_model");
require("dotenv").config();

module.exports = {
  addUser: (req, res) => {
    // create a sample user
    let user = new user_model({
      name: req.body.name,
      password: req.body.password,
      admin: req.body.admin
    });

    // save the sample user
    user.save((err, data) => {
      if (err) {
        res.status(500).send({ error: err });
      }
      if (data) {
        res.status(200).send({ message: "User saved successfully" });
      } else {
        res.status(404).send();
      }
    });
  },

  deleteUser: (req, res) => {
    let user_id = "";
    user_model.findOne(
      { name: req.params.name },
      (err, data) => {
        if (err) {
          res.status(500).send(err);
        }
        if (data) {
          user_id = data.id;
          user_model.findByIdAndRemove(user_id, (err, data) => {
            if (err) {
              res.status(500).send(err);
            }
            if (data) {
              res.status(200).send(data);
            } else {
              res.status(404).send();
            }
          });
        } else {
          res.status(404).send({ error: "This input name doesn't exist" });
        }
      }
    );
  },

  authneticate: (req, res) => {
    // find the user
    user_model.findOne(
      {
        name: req.body.name
      },
      (err, user) => {
        if (err) {
          res.status(500).send(err);
        }

        if (!user) {
          res.json({
            success: false,
            message: "Authentication failed. User not found."
          });
        } else if (user) {
          // check if password matches
          if (user.password != req.body.password) {
            res.json({
              success: false,
              message: "Authentication failed. Wrong password."
            });
          } else {
            // if user is found and password is right
            // create a token with only our given payload
            // we don't want to pass in the entire user since that has the password
            const payload = {
              admin: user.admin
            };
            let token = jwt.sign(payload, process.env.SUPER_SECRET, {
              expiresIn: 86400
            });

            // return the information including token as JSON
            res.json({
              success: true,
              message: "Enjoy your token!",
              token: token
            });
          }
        }
      }
    );
  }
};
