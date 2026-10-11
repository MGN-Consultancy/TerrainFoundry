// The packaged client includes the pinned standalone module in desktop/vendor.
try{module.exports=require('./vendor/fflate.cjs');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;module.exports=require('fflate');}
