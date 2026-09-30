using System;using System.IO;using System.Reflection;using System.Diagnostics;using System.Threading;using System.Windows.Forms;using System.Drawing;
namespace TerrainFoundry {
 public class LauncherUiTests {
  static object Field(Launcher f,string name){return typeof(Launcher).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(f);}
  static void Require(bool condition,string message){if(!condition)throw new Exception(message);}
  static void Pump(Func<bool> done,int seconds){var time=Stopwatch.StartNew();Application.DoEvents();while(!done()){Application.DoEvents();Thread.Sleep(20);if(time.Elapsed.TotalSeconds>seconds)throw new Exception("UI operation timed out");}Application.DoEvents();}
  [STAThread]public static int Main(string[] args){
   Launcher form=null;
   try{
    System.Net.ServicePointManager.SecurityProtocol=System.Net.SecurityProtocolType.Tls12;Application.EnableVisualStyles();
    form=(Launcher)Activator.CreateInstance(typeof(Launcher),true);
    string root=(string)typeof(Launcher).GetField("Root",BindingFlags.Static|BindingFlags.NonPublic).GetValue(null);
    Require(Path.GetFullPath(root).TrimEnd('\\')==AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\'),"The configured installation folder was ignored");
    form.ShowInTaskbar=false;form.StartPosition=FormStartPosition.Manual;form.Location=new Point(-10000,-10000);form.Show();
    Pump(()=>!(bool)Field(form,"busy"),60);
    var install=(Button)Field(form,"install");var status=(Label)Field(form,"status");
    Require(install.Enabled,"First installation was not offered: "+status.Text);
    Require(status.Text.Contains("Download size:"),"Offer is missing download size");
    Require(!File.Exists(Path.Combine(root,"state.json")),"Startup silently activated an installation");
    Require(!Directory.Exists(Path.Combine(root,"packages")),"Startup downloaded packages before consent");
    using(var bitmap=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(bitmap,new Rectangle(0,0,form.Width,form.Height));bitmap.Save(Path.Combine(root,"update-offer.png"));}
    Console.WriteLine("PASS: startup only checks; visible install offer includes size; no package download or activation before consent; custom installation folder selected.");
    if(Array.IndexOf(args,"--install")>=0){
     // Reuse an already verified production cache to test activation without a second large download.
     var cache=Array.Find(args,x=>x.StartsWith("--seed-cache="));
     if(cache!=null){var source=cache.Substring("--seed-cache=".Length);foreach(var file in Directory.GetFiles(source,"*",SearchOption.AllDirectories)){var target=Path.Combine(root,"packages",file.Substring(source.Length).TrimStart('\\','/'));Directory.CreateDirectory(Path.GetDirectoryName(target));File.Copy(file,target);}}
     install.PerformClick();Pump(()=>!(bool)Field(form,"busy"),600);
     Require(File.Exists(Path.Combine(root,"state.json")),"Approved installation failed: "+status.Text);
     var state=File.ReadAllText(Path.Combine(root,"state.json"));
     Require(Directory.Exists(Path.Combine(root,"packages")),"Packages were not installed into the chosen folder");
     Require(state.Contains(root.Replace("\\","\\\\").TrimEnd('\\')),"Activation points outside the chosen folder");
     Console.WriteLine("PASS: explicit install action verifies and activates client/scenery inside the chosen directory.");
    }
    return 0;
   }catch(Exception e){Console.Error.WriteLine(e);return 1;}
   finally{if(form!=null)form.Dispose();}
  }
 }
}
