import { sendMailToOwner } from "../config/nodemailler.js"
import Estudiante from "../models/Estudiante.js"
import { v2 as cloudinary } from 'cloudinary'
import fs from "fs-extra"
import mongoose from "mongoose"
import { crearTokenJWT } from "../middlewares/JWT.js"
import Deportes from "../models/Deportes.js"


const registrarEstudiante= async(req,res) => {
    //   -------------------  1
    const {emailEstudiante} = req.body

    //   -------------------  2
    if (Object.values(req.body).includes("")) return res.status(400).json({msg:"Lo sentimos, debes llenar todos los campos"})

    const verificarEmailBDD = await Estudiante.findOne({emailEstudiante})
    if(verificarEmailBDD) return res.status(400).json({msg:"Lo sentimos, el email ya se encuentra registrado"})

    //   -------------------  3
    const password = Math.random().toString(36).toUpperCase().slice(2, 5)

    const nuevoEstudiante= new Estudiante({
        ...req.body, 
        passwordEstudiante: await Estudiante.prototype.encrypPassword("ESFOT"+password),
        administrador: req.administradorBDD._id
    })

    if(req.files?.imagen){
        const { secure_url, public_id } = await cloudinary.uploader.upload(req.files.imagen.tempFilePath,{folder:'Estudiantes', resource_type: 'auto'})
        nuevoEstudiante.avatarCarrera = secure_url
        nuevoEstudiante.avatarCarreraID = public_id
        await fs.unlink(req.files.imagen.tempFilePath)
    }


        if (req.body?.avatarCarreraIA) {
    // data:image/png;base64,iVBORw0KGgjbjgfyvh
    // iVBORw0KGgjbjgfyvh
    const base64Data = req.body.avatarCarreraIA.replace(/^data:image\/\w+;base64,/, '')
    // iVBORw0KGgjbjgfyvh  -  010101010101010101
    const buffer = Buffer.from(base64Data, 'base64')
    const { secure_url } = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'Estudiantes', resource_type: 'auto' }, (error, response) => {
            if (error) {
                reject(error)
            } else {
                resolve(response)
            }
        })
        stream.end(buffer)
    })
        nuevoEstudiante.avatarCarreraIA = secure_url
    }
    
    
    await nuevoEstudiante.save()

    await sendMailToOwner(emailEstudiante,"ESFOT"+password) // ESFOT4FEE

    //   -------------------  4
    res.status(201).json({msg:"Registro exitoso del estudiante y correo enviado", nuevoEstudiante})
}



const listarEstudiantes = async (req,res)=>{
    if (req.estudianteBDD?.rol ==="estudiante"){
        const estudiantes = await Estudiante.find(req.estudianteBDD._id).select("-salida -createdAt -updatedAt -__v").populate('administrador','_id nombre apellido')
        res.status(200).json(estudiantes)
    }
    else{
        const estudiantes = await Estudiante.find({estadoEstudiante:true}).where('administrador').equals(req.administradorBDD).select("-salida -createdAt -updatedAt -__v").populate('administrador','_id nombre apellido')
        res.status(200).json(estudiantes)
    }
}

const detalleEstudiante = async(req,res)=>{
    const {id} = req.params
    if( !mongoose.Types.ObjectId.isValid(id) ) return res.status(404).json({msg:`Lo sentimos, no existe el administrador ${id}`});
    const estudiante = await Estudiante.findById(id).select("-createdAt -updatedAt -__v").populate('administrador','_id nombre apellido')

    const deportes = await Deporte.find().where('estudiante').equals(id)
    res.status(200).json({
        estudiante,
        Deporte
    })
}


const eliminarEstudiante = async (req,res)=>{
    const {id} = req.params
    if (Object.values(req.body).includes("")) return res.status(400).json({msg:"Lo sentimos, debes llenar todos los campos"})
    if( !mongoose.Types.ObjectId.isValid(id) ) return res.status(404).json({msg:`Lo sentimos, no existe el administrador ${id}`})
    const {periodoEstudiante} = req.body
    await Estudiante.findByIdAndUpdate(req.params.id,{periodoEstudiante:String.parse(periodoEstudiante),estadoEstudiante:false})
    res.status(200).json({ msg: "Periodo del estudiante registrado y estado actualizado exitosamente" });
}



const actualizarEstudiante = async(req,res)=>{
    const {id} = req.params
    if (Object.values(req.body).includes("")) return res.status(400).json({msg:"Lo sentimos, debes llenar todos los campos"})
    if( !mongoose.Types.ObjectId.isValid(id) ) return res.status(404).json({msg:`Lo sentimos, no existe el administrador ${id}`})
    if (req.files?.imagen) {
        const estudiante = await Estudiante.findById(id)
        if (estudiante.avatarCarreraID) {
            await cloudinary.uploader.destroy(estudiante.avatarCarreraID);
        }
        const cloudiResponse = await cloudinary.uploader.upload(req.files.imagen.tempFilePath, { folder: 'Estudiantes' });
        req.body.avatarCarrera = cloudiResponse.secure_url;
        req.body.avatarCarreraID = cloudiResponse.public_id;
        await fs.unlink(req.files.imagen.tempFilePath);
    }
    await Estudiante.findByIdAndUpdate(id, req.body, { new: true })
    res.status(200).json({msg:"Actualización exitosa del estudiante"})
}



const loginEstudiante = async(req,res)=>{
    const {email:emailEstudiante, password:passwordEstudiante} = req.body;
    if (Object.values(req.body).includes("")) return res.status(404).json({msg:"Lo sentimos, debes llenar todos los campos"})
    const estudianteBDD = await Estudiante.findOne({emailEstudiante})
    if(!estudianteBDD) return res.status(404).json({msg:"Lo sentimos, el usuario no se encuentra registrado"})
    const verificarPassword = await estudianteBDD.matchPassword(passwordEstudiante)
    if(!verificarPassword) return res.status(404).json({msg:"Lo sentimos, el password no es el correcto"})
    const token = crearTokenJWT(estudianteBDD._id,estudianteBDD.rol)
	const {_id,rol} = estudianteBDD
    res.status(200).json({
        token,
        rol,
        _id
    })
}


const perfilEstudiante = (req, res) => {
    
    const camposAEliminar = [
        
        "estadoEstudiante", "administrador",
        "passwordEstudiante", 
        "avatarCarrera", "avatarCarreraIA","avatarCarreraID", "createdAt", "updatedAt", "__v"
    ]

    camposAEliminar.forEach(campo => delete req.estudianteBDD[campo])

    res.status(200).json(req.estudianteBDD)
}




export{
    registrarEstudiante,
    listarEstudiantes,
    detalleEstudiante,
    eliminarEstudiante,
    actualizarEstudiante,
    loginEstudiante,
    perfilEstudiante
}
