using System;using System.IO;using System.Diagnostics;using System.Reflection;using System.Threading;
namespace TerrainFoundry {class LauncherHandoffTests {
 static object Call(string name,params object[] args){try{return typeof(Launcher).GetMethod(name,BindingFlags.NonPublic|BindingFlags.Static).Invoke(null,args);}catch(TargetInvocationException e){throw e.InnerException;}}
 [STAThread]static int Main(string[] args){
  if(args.Length>0&&args[0].StartsWith("--finish-launcher-update=")){Launcher.Main(args);return Environment.ExitCode;}
  if(args.Length>0&&args[0].StartsWith("--approved-channel=")){File.WriteAllText(Path.Combine(Environment.GetEnvironmentVariable("TERRAIN_TEST_ROOT"),"restarted.txt"),args[0]);return 0;}
  if(args.Length>0&&args[0]=="--parent"){Call("WriteRestart",Path.Combine(Environment.GetEnvironmentVariable("TERRAIN_TEST_ROOT"),"TerrainFoundryLauncher.exe"),new string('a',64));Thread.Sleep(300);return 0;}
  string root=Path.Combine(Path.GetTempPath(),"foundry handoff ' custom "+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(root);Environment.SetEnvironmentVariable("TERRAIN_TEST_ROOT",root);
  try{
   string target=Path.Combine(root,"TerrainFoundryLauncher.exe"),pending=target+".pending",helper=Path.Combine(root,"TerrainFoundryLauncher-next.exe");
   File.Copy(Assembly.GetExecutingAssembly().Location,helper);File.Copy(helper,pending);File.Copy(helper,target);File.AppendAllText(target,"old launcher overlay");string oldHash=(string)Call("Hash",target);File.WriteAllText(Path.Combine(root,"installation.json"),"custom folder");File.WriteAllText(Path.Combine(root,"state.json"),"existing scenes and assets");
   using(var parent=Process.Start(new ProcessStartInfo(target,"--parent"){UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=root})){if(!parent.WaitForExit(15000))throw new Exception("Parent did not exit");if(parent.ExitCode!=0)throw new Exception("Parent failed");}
   string receipt=Path.Combine(root,"restarted.txt");var deadline=DateTime.UtcNow.AddSeconds(20);while(!File.Exists(receipt)&&DateTime.UtcNow<deadline)Thread.Sleep(100);
   if(File.ReadAllText(receipt)!="--approved-channel="+new string('a',64))throw new Exception("Update approval lost");
   if((string)Call("Hash",target)!=(string)Call("Hash",helper))throw new Exception("Launcher not replaced");
   if((string)Call("Hash",target+".previous")!=oldHash||File.ReadAllText(Path.Combine(root,"state.json"))!="existing scenes and assets"||File.ReadAllText(Path.Combine(root,"installation.json"))!="custom folder")throw new Exception("Existing installation changed");
   File.WriteAllText(pending,"tampered");bool rejected=false;try{Call("ReplaceLauncherFile",pending,target,(string)Call("Hash",helper));}catch{rejected=true;}if(!rejected)throw new Exception("Tampered pending accepted");
   Console.WriteLine("PASS native self-update waits for old process, replaces launcher, restarts with approval, preserves custom installation and rejects tampered staging. No PowerShell restart script.");return 0;
  }catch(Exception e){Console.Error.WriteLine(e);return 1;}finally{Thread.Sleep(500);try{Directory.Delete(root,true);}catch{}}
 }
}}
