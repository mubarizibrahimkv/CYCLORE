const express=require("express")
const app=express()
require("dotenv").config()
const connectDB=require("./db/connectDB")
const adminRouter=require("./routes/adminRouter")
const userRouter=require("./routes/userRouter")
const passport=require("./config/passport")
const path=require("path");
const hbs=require("hbs")
const session=require("express-session")
const nocache=require("nocache")



app.use(nocache())
app.use(session({
    secret:"mysecretkey",
    resave:false,
    saveUninitialized:true,
    cookie:{
        maxAge:1000*60*60*24,
        httpOnly:true,
        secure:false
    }
}))

app.use(passport.initialize())
app.use(passport.session())

hbs.registerHelper('json', function (context) {
    return JSON.stringify(context);  // Converts the object to a JSON string
});

app.use("/uploads", express.static("uploads"))
app.set('views',path.join(__dirname,'view'))
app.set("view engine","hbs")
app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({extended:true}))
app.use(express.json())


app.use("/admin",adminRouter)
app.use("/",userRouter)

connectDB();

app.listen(3000,()=>{
    console.log("server is working");
})

