import prisma from "../config/prisma.js";

export const listTechnicians = async (req,res,next)=>{try{
  const technicians=await prisma.technician.findMany({include:{user:{select:{id:true,name:true,email:true,phone:true,role:true}}},orderBy:{createdAt:"desc"}});
  res.json({success:true,count:technicians.length,technicians});
}catch(e){next(e)}};

export const assignTechnician = async (req,res,next)=>{try{
  const complaintId=Number(req.params.id);
  const technicianId=Number(req.body.technicianId);
  if(!Number.isInteger(complaintId)||!Number.isInteger(technicianId)) return res.status(400).json({success:false,message:"Valid complaint id and technicianId are required"});
  const complaint=await prisma.complaint.findUnique({where:{id:complaintId}});
  if(!complaint) return res.status(404).json({success:false,message:"Complaint not found"});
  const technician=await prisma.technician.findUnique({where:{id:technicianId}});
  if(!technician) return res.status(404).json({success:false,message:"Technician not found"});
  if(!technician.availability) return res.status(400).json({success:false,message:"Technician is currently unavailable"});
  const updated=await prisma.complaint.update({where:{id:complaintId},data:{technicianId,status:"ASSIGNED"},include:{product:true,technician:{include:{user:{select:{id:true,name:true,email:true,phone:true}}}}}});
  res.json({success:true,message:"Technician assigned successfully",complaint:updated});
}catch(e){next(e)}};

export const updateComplaintStatus = async (req,res,next)=>{try{
  const complaintId=Number(req.params.id);
  const {status}=req.body;
  const allowed=["REGISTERED","ASSIGNED","IN_PROGRESS","COMPLETED","CANCELLED"];
  if(!Number.isInteger(complaintId)) return res.status(400).json({success:false,message:"Invalid complaint id"});
  if(!allowed.includes(status)) return res.status(400).json({success:false,message:`Status must be one of: ${allowed.join(", ")}`});
  const complaint=await prisma.complaint.findUnique({where:{id:complaintId}});
  if(!complaint) return res.status(404).json({success:false,message:"Complaint not found"});
  if(req.user.role==="TECHNICIAN"){
    const tech=await prisma.technician.findUnique({where:{userId:req.user.id}});
    if(!tech || complaint.technicianId!==tech.id) return res.status(403).json({success:false,message:"This complaint is not assigned to you"});
  }
  const updated=await prisma.complaint.update({where:{id:complaintId},data:{status,completedAt:status==="COMPLETED"?new Date():null}});
  res.json({success:true,message:"Complaint status updated successfully",complaint:updated});
}catch(e){next(e)}};

export const getMyJobs = async (req,res,next)=>{try{
  const tech=await prisma.technician.findUnique({where:{userId:req.user.id}});
  if(!tech) return res.status(404).json({success:false,message:"Technician profile not found"});
  const complaints=await prisma.complaint.findMany({where:{technicianId:tech.id},include:{product:true,customer:{select:{id:true,name:true,phone:true,email:true}}},orderBy:{createdAt:"desc"}});
  res.json({success:true,count:complaints.length,complaints});
}catch(e){next(e)}};
