const express = require("express")
const app = express()
require('dotenv').config();
const methodOverride = require('method-override');
const connectDB = require("./db/connectDB")
const adminRouter = require("./routes/adminRouter")
const userRouter = require("./routes/userRouter")
const orderRouter = require("./routes/orderRouter")
const inventoryRouter = require("./routes/inventoryRouter")
const profileRouter = require("./routes/profileRouter")
const salesRouter = require("./routes/salesRouter")
const discountRouter=require("./routes/discountRouter")
const salesReportRouter=require("./routes/salesReportRouter")
const passport = require("./config/passport")
const path = require("path");
const hbs = require("hbs")
const session = require("express-session")
const nocache = require("nocache")


//--------------session-----------
app.use(nocache())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        secure: false
    }
}))

//---------google------------
app.use(passport.initialize())
app.use(passport.session())


//----------------------Helpers--------------//
const formatHelpers = require('./helpers/format');
const mathHelpers = require('./helpers/math');
const dateHelpers = require('./helpers/date');
const arrayHelpers = require('./helpers/array');
const modalHelpers = require('./helpers/modal');

hbs.registerHelper(formatHelpers);
hbs.registerHelper(mathHelpers);
hbs.registerHelper(dateHelpers);
hbs.registerHelper(arrayHelpers);
hbs.registerHelper(modalHelpers);


app.use(methodOverride('_method'));

app.use("/uploads", express.static("uploads"))
app.set('views', path.join(__dirname, 'view'))
app.set("view engine", "hbs")
app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

//---------------router----------------
app.use("/admin", adminRouter)
app.use("/admin", orderRouter)
app.use("/admin", inventoryRouter)
app.use("/admin", discountRouter)
app.use("/admin", salesReportRouter)
app.use("/", userRouter)
app.use("/", profileRouter)
app.use("/", salesRouter)
  

connectDB()

const PORT = process.env.PORT
app.listen(PORT, () => {
    console.log("server is working");
})