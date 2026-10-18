using System;
using System.IO;
using System.Reflection;
using System.Collections.Generic;
namespace TerrainFoundry {
 public class LauncherRuntimeFilesTests {
  static int assertions;
  static object Call(string name,params object[] args){try{return typeof(Launcher).GetMethod(name,BindingFlags.NonPublic|BindingFlags.Static).Invoke(null,args);}catch(TargetInvocationException error){throw error.InnerException;}}
  static void Pass(string method,string folder,Dictionary<string,object> package,string name){Call(method,folder,package);assertions++;Console.WriteLine("PASS "+name);}
  static void Reject(string method,string folder,Dictionary<string,object> package,string name){try{Call(method,folder,package);}catch{assertions++;Console.WriteLine("PASS rejects "+name);return;}throw new Exception("Accepted "+name);}
  public static int Main(){string root=Path.Combine(Path.GetTempPath(),"tf-launcher-runtime-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(root);try{
   string exe=Path.Combine(root,"TerrainFoundry.exe");File.WriteAllText(exe,"signed-file-fixture");string digest=(string)Call("Hash",exe);
   var files=new Dictionary<string,object>{{"TerrainFoundry.exe",new Dictionary<string,object>{{"sha256",digest}}}};
   var client=new Dictionary<string,object>{{"files",files}};
   Pass("CheckClient",root,client,"unchanged file-set client");
   File.WriteAllText(Path.Combine(root,"debug.log"),"");Pass("CheckClient",root,client,"exact root empty Chromium debug.log");
   File.WriteAllText(Path.Combine(root,"debug.log"),"ordinary diagnostic output");Pass("CheckClient",root,client,"exact root populated Chromium debug.log");
   File.WriteAllText(exe,"tampered");Reject("CheckClient",root,client,"signed file tampering despite diagnostic exception");File.WriteAllText(exe,"signed-file-fixture");
   File.Delete(exe);Reject("CheckClient",root,client,"missing signed executable despite diagnostic exception");File.WriteAllText(exe,"signed-file-fixture");
   foreach(string extra in new[]{"arbitrary.log","debug.log.exe","extra.dll","extra.exe","verified.json"}){string full=Path.Combine(root,extra);File.WriteAllText(full,"unexpected");Reject("CheckClient",root,client,"file-set extra "+extra);File.Delete(full);}
   Directory.CreateDirectory(Path.Combine(root,"nested"));File.WriteAllText(Path.Combine(root,"nested","debug.log"),"unexpected");Reject("CheckClient",root,client,"nested debug.log");Directory.Delete(Path.Combine(root,"nested"),true);
   var signedLog=new Dictionary<string,object>{{"files",new Dictionary<string,object>{{"TerrainFoundry.exe",files["TerrainFoundry.exe"]},{"debug.log",new Dictionary<string,object>{{"sha256",digest}}}}}};
   Reject("CheckClient",root,signedLog,"manifest-listed log still requires its signed hash");
   var legacy=new Dictionary<string,object>{{"files",new Dictionary<string,object>{{"TerrainFoundry.exe",digest}}}};
   File.WriteAllText(Path.Combine(root,"verified.json"),"{}");Pass("CheckInventory",root,legacy,"legacy client retains install receipt plus exact runtime log");
   File.WriteAllText(Path.Combine(root,"extra.json"),"{}");Reject("CheckInventory",root,legacy,"legacy arbitrary metadata extra");File.Delete(Path.Combine(root,"extra.json"));
   File.Delete(exe);File.WriteAllText(Path.Combine(root,"meshes.bin"),"scenery");string sceneryHash=(string)Call("Hash",Path.Combine(root,"meshes.bin"));var scenery=new Dictionary<string,object>{{"files",new Dictionary<string,object>{{"meshes.bin",sceneryHash}}}};
   Reject("CheckInventory",root,scenery,"diagnostic exception in a scenery package");File.Delete(Path.Combine(root,"debug.log"));Pass("CheckInventory",root,scenery,"unchanged legacy scenery with install receipt");
   Console.WriteLine("PASS "+assertions+" launcher runtime-file checks; no installed files touched");return 0;
  }catch(Exception error){Console.Error.WriteLine(error);return 1;}finally{Directory.Delete(root,true);}}
 }
}
