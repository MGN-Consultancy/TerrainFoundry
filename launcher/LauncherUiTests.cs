using System;using System.IO;using System.Reflection;using System.Threading.Tasks;using System.Windows.Forms;using System.Drawing;
namespace TerrainFoundry {
 public class LauncherUiTests {
  class Offline:System.Net.Http.HttpMessageHandler{protected override Task<System.Net.Http.HttpResponseMessage> SendAsync(System.Net.Http.HttpRequestMessage request,System.Threading.CancellationToken token){throw new System.Net.Http.HttpRequestException("Offline test");}}
  static object Field(Launcher f,string name){return typeof(Launcher).GetField(name,BindingFlags.Instance|BindingFlags.NonPublic).GetValue(f);}
  static void Require(bool condition,string message){if(!condition)throw new Exception(message);}
  static async Task Idle(Launcher form){var until=DateTime.UtcNow.AddMinutes(10);do{await Task.Delay(40);if(DateTime.UtcNow>until)throw new Exception("UI timed out");}while((bool)Field(form,"busy"));}
  static Task Check(Launcher form){return (Task)typeof(Launcher).GetMethod("Update",BindingFlags.Instance|BindingFlags.NonPublic|BindingFlags.DeclaredOnly).Invoke(form,null);}
  [STAThread]public static int Main(string[] args){
   System.Net.ServicePointManager.SecurityProtocol=System.Net.SecurityProtocolType.Tls12;
   Application.SetUnhandledExceptionMode(UnhandledExceptionMode.ThrowException);Application.EnableVisualStyles();
   int result=1;var form=(Launcher)Activator.CreateInstance(typeof(Launcher),true);
   form.ShowInTaskbar=false;form.StartPosition=FormStartPosition.Manual;form.Location=new Point(-10000,-10000);
   form.Shown+=async(sender,e)=>{
    try{
     await Idle(form);
     string root=(string)typeof(Launcher).GetField("Root",BindingFlags.Static|BindingFlags.NonPublic).GetValue(null);
     Require(Path.GetFullPath(root).TrimEnd('\\')==AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\'),"Chosen installation folder ignored");
     var install=(Button)Field(form,"install");var play=(Button)Field(form,"play");var decline=(Button)Field(form,"decline");
     var offer=(FlowLayoutPanel)Field(form,"offer");var progress=(ProgressBar)Field(form,"progress");var status=(Label)Field(form,"status");
     Require(install.Enabled&&offer.Visible&&status.Text.Contains("Estimated download:"),"First install offer missing: "+status.Text);
     Require(form.ClientSize.Height<=520&&form.ClientSize.Width<=760,"Launcher still has excessive empty height.");
     using(var art=typeof(Launcher).Assembly.GetManifestResourceStream("launcher-scene.jpg"))Require(art!=null,"Website scene art was not embedded in the launcher.");
     var setPhase=typeof(Launcher).GetMethod("SetPhase",BindingFlags.Instance|BindingFlags.NonPublic);setPhase.Invoke(form,new object[]{"EDITOR  ·  PHASE 1 OF 2"});var phase=(Label)Field(form,"phase");Require(phase.Visible&&phase.Text.Contains("PHASE 1 OF 2")&&progress.Value==0,"Phase transition did not reset progress clearly.");typeof(Launcher).GetMethod("StopProgress",BindingFlags.Instance|BindingFlags.NonPublic).Invoke(form,null);
     Require(play.Text=="Open Editor"&&play.Width<200&&!play.Enabled&&install.Width<200,"Compact buttons or first-install readiness incorrect");
     Require(!File.Exists(Path.Combine(root,"state.json"))&&!Directory.Exists(Path.Combine(root,"packages")),"Startup downloaded or activated without consent");
     Require(progress.Style==ProgressBarStyle.Continuous,"Progress did not stop after check");
     using(var bitmap=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(bitmap,new Rectangle(0,0,form.Width,form.Height));bitmap.Save(Path.Combine(root,"update-offer.png"));}
     decline.PerformClick();Require(!offer.Visible&&!play.Enabled,"Decline failed before installation");await Check(form);
     Console.WriteLine("PASS: automatic check, compact consent, decline, no premature download, progress and chosen directory.");
     if(Array.IndexOf(args,"--install")>=0){
      var cache=Array.Find(args,x=>x.StartsWith("--seed-cache="));
      if(cache!=null){var source=cache.Substring("--seed-cache=".Length);foreach(var file in Directory.GetFiles(source,"*",SearchOption.AllDirectories)){var target=Path.Combine(root,"packages",file.Substring(source.Length).TrimStart('\\','/'));Directory.CreateDirectory(Path.GetDirectoryName(target));File.Copy(file,target);}}
      install.PerformClick();Require(!play.Enabled&&!offer.Visible,"Controls enabled during update");await Idle(form);
      Require(File.Exists(Path.Combine(root,"state.json")),"Install failed: "+status.Text);
      Require(play.Enabled&&!offer.Visible&&progress.Value==100,"Editor not ready: "+status.Text);
      var saved=File.ReadAllText(Path.Combine(root,"state.json"));Require(saved.Contains(root.Replace("\\","\\\\").TrimEnd('\\')),"Packages activated outside chosen folder");
      await Check(form);Require(!offer.Visible&&play.Enabled,"Up-to-date install still offers update");
      var serializer=new System.Web.Script.Serialization.JavaScriptSerializer{MaxJsonLength=4194304};
      var previous=serializer.Deserialize<System.Collections.Generic.Dictionary<string,object>>(saved);previous["envelope"]=(string)previous["envelope"]+" ";
      File.WriteAllText(Path.Combine(root,"state.json"),serializer.Serialize(previous));await Check(form);
      Require(offer.Visible&&install.Text=="Update now"&&play.Enabled,"Optional update offer missing");
      var before=File.ReadAllText(Path.Combine(root,"state.json"));decline.PerformClick();
      Require(!offer.Visible&&play.Enabled&&File.ReadAllText(Path.Combine(root,"state.json"))==before,"Decline altered state or blocked editor");
      File.WriteAllText(Path.Combine(root,"state.json"),saved);
      var httpField=typeof(Launcher).GetField("http",BindingFlags.Static|BindingFlags.NonPublic);var original=httpField.GetValue(null);
      using(var offline=new System.Net.Http.HttpClient(new Offline())){httpField.SetValue(null,offline);await Check(form);Require(play.Enabled&&!offer.Visible&&status.Text.Contains("offline"),"Offline check blocked installed editor");}httpField.SetValue(null,original);
      Console.WriteLine("PASS: approved activation, progress completion, current installation, update decline and existing editor readiness.");
     }
     result=0;
    }catch(Exception ex){Console.Error.WriteLine(ex);}
    finally{form.Close();}
   };
   Application.Run(form);form.Dispose();return result;
  }
 }
}
