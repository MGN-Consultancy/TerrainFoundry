using System;using System.IO;using System.IO.Compression;using System.Net;using System.Net.Http;using System.Linq;using System.Text;using System.Collections.Generic;using System.Security.Cryptography;using System.Diagnostics;using System.Threading;using System.Threading.Tasks;using System.Web.Script.Serialization;using System.Windows.Forms;
[assembly:System.Reflection.AssemblyVersion("1.15.2.0")]
[assembly:System.Reflection.AssemblyProduct("Terrain Foundry Launcher")]
namespace TerrainFoundry {
 sealed class WorkshopButton:Button {
  public WorkshopButton(){FlatStyle=FlatStyle.Flat;FlatAppearance.BorderSize=0;Cursor=Cursors.Hand;UseVisualStyleBackColor=false;SetStyle(ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.AllPaintingInWmPaint,true);}
  protected override void OnPaint(PaintEventArgs e){var g=e.Graphics;g.SmoothingMode=System.Drawing.Drawing2D.SmoothingMode.AntiAlias;var r=new System.Drawing.Rectangle(1,1,Width-3,Height-5);using(var shape=Rounded(r,12))using(var fill=new System.Drawing.Drawing2D.LinearGradientBrush(r,Enabled?System.Drawing.Color.FromArgb(242,216,160):System.Drawing.Color.FromArgb(76,87,96),Enabled?System.Drawing.Color.FromArgb(196,156,85):System.Drawing.Color.FromArgb(54,66,77),90)){using(var shadow=new System.Drawing.SolidBrush(System.Drawing.Color.FromArgb(7,13,20)))g.FillRectangle(shadow,8,Height-8,Width-16,5);g.FillPath(fill,shape);using(var edge=new System.Drawing.Pen(System.Drawing.Color.FromArgb(139,116,74)))g.DrawPath(edge,shape);}TextRenderer.DrawText(g,Text,Font,r,Enabled?System.Drawing.Color.FromArgb(20,30,37):System.Drawing.Color.FromArgb(165,176,184),TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter);if(Focused)ControlPaint.DrawFocusRectangle(g,new System.Drawing.Rectangle(7,7,Width-14,Height-18));}
  internal static System.Drawing.Drawing2D.GraphicsPath Rounded(System.Drawing.Rectangle r,int radius){var p=new System.Drawing.Drawing2D.GraphicsPath();p.AddArc(r.Left,r.Top,radius,radius,180,90);p.AddArc(r.Right-radius,r.Top,radius,radius,270,90);p.AddArc(r.Right-radius,r.Bottom-radius,radius,radius,0,90);p.AddArc(r.Left,r.Bottom-radius,radius,radius,90,90);p.CloseFigure();return p;}
 }
 sealed class WorkshopHero:Panel {
  System.Drawing.Image art;
  public WorkshopHero(){DoubleBuffered=true;using(var source=typeof(Launcher).Assembly.GetManifestResourceStream("launcher-scene.png")){if(source!=null)using(var image=System.Drawing.Image.FromStream(source))art=new System.Drawing.Bitmap(image);}}
  protected override void Dispose(bool disposing){if(disposing&&art!=null)art.Dispose();base.Dispose(disposing);}
  protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);var g=e.Graphics;float scale=g.DpiX/96f;g.SmoothingMode=System.Drawing.Drawing2D.SmoothingMode.AntiAlias;if(art!=null){float ratio=Math.Max((float)Width/art.Width,(float)Height/art.Height);g.DrawImage(art,Width-art.Width*ratio,(Height-art.Height*ratio)/2,art.Width*ratio,art.Height*ratio);}using(var shade=new System.Drawing.Drawing2D.LinearGradientBrush(ClientRectangle,System.Drawing.Color.FromArgb(247,12,22,31),System.Drawing.Color.FromArgb(55,12,22,31),0f))g.FillRectangle(shade,ClientRectangle);using(var gold=new System.Drawing.SolidBrush(System.Drawing.Color.FromArgb(226,192,126)))using(var white=new System.Drawing.SolidBrush(System.Drawing.Color.FromArgb(243,242,235)))using(var muted=new System.Drawing.SolidBrush(System.Drawing.Color.FromArgb(185,201,210)))using(var title=new System.Drawing.Font("Segoe UI",24,System.Drawing.FontStyle.Bold))using(var small=new System.Drawing.Font("Segoe UI",9,System.Drawing.FontStyle.Bold))using(var text=new System.Drawing.Font("Segoe UI",11)){var x=28*scale;using(var icon=System.Drawing.Icon.ExtractAssociatedIcon(typeof(Launcher).Assembly.Location)){if(icon!=null)g.DrawIcon(icon,new System.Drawing.Rectangle((int)x,(int)(22*scale),(int)(48*scale),(int)(48*scale)));}g.DrawString("TERRAIN FOUNDRY",title,white,x,80*scale);g.DrawString("Your desktop. Your world.",text,muted,x,126*scale);g.DrawString("OFFLINE BY CHOICE  ·  NO ACCOUNT REQUIRED",small,gold,x,165*scale);g.DrawString("SIGNED RELEASES  ·  MGN CONSULTANCY LIMITED",small,muted,x,198*scale);}}
 }
 public class Launcher:Form {
  const string Repo="MGN-Consultancy/TerrainFoundry",Publisher="MGN CONSULTANCY LIMITED";
  #if TEST_TRANSPORT
  static string Root=Environment.GetEnvironmentVariable("TERRAIN_TEST_ROOT"),StateFile=Path.Combine(Root,"state.json");
#else
  static string Root=ResolveRoot(AppDomain.CurrentDomain.BaseDirectory),StateFile=Path.Combine(Root,"state.json");
  static string ResolveRoot(string executableDirectory){return File.Exists(Path.Combine(executableDirectory,"installation.json"))?Path.GetFullPath(executableDirectory):Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"TerrainFoundryLauncher");}
#endif
  static JavaScriptSerializer Json=new JavaScriptSerializer{MaxJsonLength=4194304};
  Label status=new Label{Dock=DockStyle.Fill,Text="Checking for updates...",Padding=new Padding(24,16,24,8),AutoSize=false};
  Button play=new WorkshopButton{Text="Open Editor",Width=150,Height=38,Enabled=false};
  Button install=new WorkshopButton{Text="Update now",Width=130,Height=38,Enabled=false};
  Button decline=new WorkshopButton{Text="Not now",Width=110,Height=38};
  FlowLayoutPanel offer=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=52,Padding=new Padding(24,4,0,4),Visible=false};
  ProgressBar progress=new ProgressBar{Dock=DockStyle.Fill,Style=ProgressBarStyle.Marquee,MarqueeAnimationSpeed=28};
  string pendingEnvelope;Dictionary<string,object> pendingRelease;
  static string approvedChannel;
  bool busy,launchAfterCancel,closeAfterCancel; CancellationTokenSource cancellation=new CancellationTokenSource(); static HttpClient http=new HttpClient{Timeout=TimeSpan.FromMinutes(30)};
  [STAThread] public static void Main(string[] args){if(args.Length>0&&args[0].StartsWith("--finish-launcher-update=")){FinishLauncherUpdate(args);return;}approvedChannel=args.FirstOrDefault(x=>x.StartsWith("--approved-channel="));ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;Directory.CreateDirectory(Root);using(var mutex=new Mutex(false,"Local\\TerrainFoundryLauncher")){if(!mutex.WaitOne(0))return;Application.EnableVisualStyles();Application.Run(new Launcher());}}
  Launcher(){
   Icon=System.Drawing.Icon.ExtractAssociatedIcon(typeof(Launcher).Assembly.Location);
   Text="Terrain Foundry";ClientSize=new System.Drawing.Size(800,620);MinimumSize=new System.Drawing.Size(740,620);StartPosition=FormStartPosition.CenterScreen;AutoScaleMode=AutoScaleMode.Dpi;
   Font=new System.Drawing.Font("Segoe UI",10);BackColor=System.Drawing.Color.FromArgb(16,25,34);ForeColor=System.Drawing.Color.FromArgb(233,237,240);
   var hero=new WorkshopHero{Dock=DockStyle.Top,Height=244};
   var location=new Label{Dock=DockStyle.Bottom,Height=58,Padding=new Padding(28,8,28,8),AutoEllipsis=true,ForeColor=System.Drawing.Color.FromArgb(153,172,184),Text="Installation folder\n"+Root};
   var actions=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=64,Padding=new Padding(28,6,0,10)};play.Width=184;play.Height=44;actions.Controls.Add(play);
   var progressArea=new Panel{Dock=DockStyle.Bottom,Height=20,Padding=new Padding(28,2,28,6)};progressArea.Controls.Add(progress);
   offer.Height=58;offer.Padding=new Padding(28,6,0,6);install.Height=44;decline.Height=44;offer.Controls.Add(install);offer.Controls.Add(decline);
   status.Padding=new Padding(28,20,28,8);status.Font=new System.Drawing.Font("Segoe UI",11);
   Controls.Add(status);Controls.Add(offer);Controls.Add(progressArea);Controls.Add(actions);Controls.Add(location);Controls.Add(hero);
   AcceptButton=play;
   play.Click+=(sender,e)=>Launch();
   decline.Click+=(sender,e)=>DeclineUpdate();install.Click+=async(sender,e)=>await ApplyUpdate();
   FormClosing+=(sender,e)=>{if(busy){e.Cancel=true;closeAfterCancel=true;cancellation.Cancel();}};
   Shown+=async(sender,e)=>{
#if TEST_UI
    status.Text="Ready to build. Your projects stay on this computer.";play.Enabled=true;StopProgress();return;
#else
    await Update();
#endif
#if TEST_TRANSPORT && !TEST_UI
    await ApplyUpdate();File.WriteAllText(Path.Combine(Root,"integration-result.txt"),status.Text);Environment.ExitCode=File.Exists(StateFile)?0:1;Close();
#endif
   };
  }
  void DeclineUpdate(){if(busy)return;offer.Visible=false;status.Text=File.Exists(StateFile)?"Ready. You can update next time you open the launcher.":"Installation postponed. Reopen the launcher when you are ready.";play.Enabled=File.Exists(StateFile);}
  long batchTotal=0,batchComplete=0,batchCurrent=0;int batchCount=0,batchDone=0;
  static string DataSize(long n){return n>=1000000000L?(n/1000000000.0).ToString("0.00")+" GB":(n/1000000.0).ToString("0.0")+" MB";}
  async Task<string> InstallTracked(Dictionary<string,object> package,bool client){batchCurrent=0;string result=await Install(package,client);batchComplete+=Convert.ToInt64(package["size"]);batchDone++;batchCurrent=0;return result;}
  void Progress(string message,int percent=-1){if(batchTotal>0){long ready=batchComplete+batchCurrent;percent=(int)Math.Min(99,ready*100/batchTotal);message="Overall "+percent+"% - "+batchDone+" of "+batchCount+" packages ready\n"+DataSize(ready)+" / "+DataSize(batchTotal)+" prepared\n\n"+message;}progress.Visible=true;status.Text=message;progress.Style=percent<0?ProgressBarStyle.Marquee:ProgressBarStyle.Continuous;if(percent>=0)progress.Value=Math.Max(0,Math.Min(100,percent));}
  void StopProgress(){progress.Visible=false;progress.Style=ProgressBarStyle.Continuous;progress.Value=File.Exists(StateFile)?100:0;}
  static Dictionary<string,object> Obj(object v){return (Dictionary<string,object>)v;}
  static string Str(Dictionary<string,object> o,string k){return Convert.ToString(o[k]);}
  static string Hash(string f){using(var s=File.OpenRead(f))using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(s)).Replace("-","").ToLowerInvariant();}
  static string SafeHash(string s){if(s.Length!=64||s.Any(c=>!"0123456789abcdef".Contains(c)))throw new Exception("Invalid package digest.");return s;}
  static void Atomic(string p,string text){string t=p+".new";File.WriteAllText(t,text,new UTF8Encoding(false));if(File.Exists(p))File.Replace(t,p,p+".previous");else File.Move(t,p);}
  static Dictionary<string,object> ReadState(){return Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(StateFile));}
  static string Under(string root,string relative){string p=Path.GetFullPath(Path.Combine(root,relative));if(!p.StartsWith(Path.GetFullPath(root)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new Exception("Unsafe package path.");return p;}
  static void VerifyPublisher(string file){var p=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","powershell.exe")){UseShellExecute=false,CreateNoWindow=true,RedirectStandardError=true,RedirectStandardOutput=true};p.EnvironmentVariables["PSModulePath"]=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"WindowsPowerShell","v1.0","Modules");string script="$s=Get-AuthenticodeSignature -LiteralPath '"+file.Replace("'","''")+"';if($s.Status -ne 'Valid' -or !$s.TimeStamperCertificate -or $s.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -ne '"+Publisher+"'){exit 1}";p.Arguments="-NoProfile -NonInteractive -EncodedCommand "+Convert.ToBase64String(Encoding.Unicode.GetBytes(script));using(var process=Process.Start(p)){if(!process.WaitForExit(90000)){process.Kill();throw new Exception("Publisher verification timed out.");}if(process.ExitCode!=0){
#if TEST_TRANSPORT
File.WriteAllText(Path.Combine(Root,"publisher-check.log"),process.StandardError.ReadToEnd()+process.StandardOutput.ReadToEnd());
#endif
throw new Exception("The package does not have a valid MGN Consultancy publisher signature.");}}}
  async Task<byte[]> Download(Dictionary<string,object> p,string destination){string url=Str(p,"url"),hash=SafeHash(Str(p,"sha256"));if(!url.StartsWith("https://github.com/"+Repo+"/releases/download/",StringComparison.Ordinal))throw new Exception("Unapproved package source.");long size=Convert.ToInt64(p["size"]);if(size<=0||size>2147483648L)throw new Exception("Invalid package size.");
   #if TEST_TRANSPORT
   string fixture=Path.Combine(Environment.GetEnvironmentVariable("TERRAIN_TEST_RELEASE"),Path.GetFileName(new Uri(url).AbsolutePath));await Task.Run(()=>File.Copy(fixture,destination,true));File.AppendAllText(Path.Combine(Root,"download-log.txt"),Path.GetFileName(fixture)+Environment.NewLine);if(new FileInfo(destination).Length!=size||Hash(destination)!=hash)throw new Exception("Fixture checksum mismatch.");return null;
#else
   using(var response=await http.GetAsync(url,HttpCompletionOption.ResponseHeadersRead,cancellation.Token)){response.EnsureSuccessStatusCode();using(var input=await response.Content.ReadAsStreamAsync())using(var output=new FileStream(destination,FileMode.Create,FileAccess.Write)){byte[] buffer=new byte[131072];long total=0;int n;while((n=await input.ReadAsync(buffer,0,buffer.Length,cancellation.Token))>0){total+=n;if(total>size)throw new Exception("Package exceeds signed size.");await output.WriteAsync(buffer,0,n,cancellation.Token);batchCurrent=total;Progress("Downloading "+Str(p,"name")+" — "+(total*100/size)+"%",(int)(total*100/size));}if(total!=size)throw new Exception("Incomplete package.");}}
   if(await Task.Run(()=>Hash(destination))!=hash)throw new Exception("Package checksum mismatch.");return null;
#endif
  }
  async Task<string> Install(Dictionary<string,object> package,bool client){string hash=SafeHash(Str(package,"sha256")),target=Path.Combine(Root,"packages",hash),complete=Path.Combine(target,"verified.json");if(File.Exists(complete)){Progress("Checking "+Str(package,"name")+"...");await Task.Run(()=>CheckInventory(target,package));return target;}
   string stage=target+".partial-"+Guid.NewGuid().ToString("N"),zip=stage+".zip";Directory.CreateDirectory(stage);
   try{await Download(package,zip);Progress("Verifying and unpacking "+Str(package,"name")+"...");await Task.Run(()=>{using(var archive=ZipFile.OpenRead(zip)){long total=0;foreach(var entry in archive.Entries){if((entry.ExternalAttributes&0x400)!=0||(entry.ExternalAttributes>>16&0xF000)==0xA000)throw new Exception("Links are not allowed in packages.");if(entry.FullName.Contains(':')||entry.FullName.Contains('\\'))throw new Exception("Unsafe archive entry.");string path=Under(stage,entry.FullName);total+=entry.Length;if(total>8589934592L)throw new Exception("Unpacked package exceeds limit.");if(entry.FullName.EndsWith("/")){Directory.CreateDirectory(path);continue;}Directory.CreateDirectory(Path.GetDirectoryName(path));entry.ExtractToFile(path,false);}}
    CheckInventory(stage,package);if(client)VerifyPublisher(Path.Combine(stage,"TerrainFoundry.exe"));var inventory=Directory.GetFiles(stage,"*",SearchOption.AllDirectories).ToDictionary(f=>f.Substring(stage.Length+1).Replace('\\','/'),f=>Hash(f));File.WriteAllText(Path.Combine(stage,"verified.json"),Json.Serialize(inventory));if(Directory.Exists(target))throw new Exception("Incomplete prior package exists; previous editor remains available.");Directory.Move(stage,target);});return target;
   }finally{if(File.Exists(zip))File.Delete(zip);if(Directory.Exists(stage))Directory.Delete(stage,true);}
  }
  static void CheckInventory(string folder,Dictionary<string,object> package){var entries=Obj(package["files"]);foreach(var file in Directory.GetFiles(folder,"*",SearchOption.AllDirectories)){string rel=file.Substring(folder.Length+1).Replace('\\','/');if(rel!="verified.json"&&!entries.ContainsKey(rel))throw new Exception("Unexpected installed file.");}foreach(var kv in entries)if(Hash(Under(folder,kv.Key))!=Convert.ToString(kv.Value))throw new Exception("Installed files changed; reinstall the affected package before opening it.");}
  static bool ContentMatches(string folder,Dictionary<string,object> pack){if(String.IsNullOrEmpty(folder)||!Directory.Exists(folder))return false;var expected=Obj(pack["files"]);if(expected.Count>2000)return false;foreach(var kv in expected){string path=Under(folder,kv.Key);if(!File.Exists(path)||Hash(path)!=Str(Obj(kv.Value),"sha256"))return false;}string indexPath=Path.Combine(folder,"index.json");if(!File.Exists(indexPath))return false;try{return Json.Serialize(Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(indexPath)))==Json.Serialize(Obj(pack["index"]));}catch{return false;}}
  static bool LegacyPieceMatches(string previous,string relative,string expectedHash){if(String.IsNullOrEmpty(previous)||!relative.StartsWith("models/",StringComparison.Ordinal)||!relative.EndsWith(".bin",StringComparison.Ordinal))return false;try{string id=Path.GetFileNameWithoutExtension(relative),indexPath=Path.Combine(previous,"index.json"),meshPath=Path.Combine(previous,"meshes.bin");if(!File.Exists(indexPath)||!File.Exists(meshPath))return false;var index=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(indexPath));if(!index.ContainsKey(id))return false;var model=Obj(index[id]);var raw=Obj(model["raw"]);var connected=Obj(model["connected"]);long offset=Convert.ToInt64(model["offset"]),length=Convert.ToInt64(raw["length"])+Convert.ToInt64(connected["length"]);if(offset<0||length<1||length>67108864||offset+length>new FileInfo(meshPath).Length)return false;byte[] bytes=new byte[(int)length];using(var source=new FileStream(meshPath,FileMode.Open,FileAccess.Read,FileShare.Read)){source.Position=offset;int read=0;while(read<bytes.Length){int n=source.Read(bytes,read,bytes.Length-read);if(n==0)return false;read+=n;}}using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(bytes)).Replace("-","").ToLowerInvariant()==expectedHash;}catch{return false;}}
  static bool MigrateLegacyPiece(string previous,string relative,string destination,string expectedHash){if(String.IsNullOrEmpty(previous)||!relative.StartsWith("models/",StringComparison.Ordinal)||!relative.EndsWith(".bin",StringComparison.Ordinal))return false;string id=Path.GetFileNameWithoutExtension(relative),indexPath=Path.Combine(previous,"index.json"),meshPath=Path.Combine(previous,"meshes.bin");if(!File.Exists(indexPath)||!File.Exists(meshPath))return false;try{var index=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(indexPath));if(!index.ContainsKey(id))return false;var model=Obj(index[id]);var raw=Obj(model["raw"]);var connected=Obj(model["connected"]);long offset=Convert.ToInt64(model["offset"]),length=Convert.ToInt64(raw["length"])+Convert.ToInt64(connected["length"]);if(offset<0||length<1||length>67108864||offset+length>new FileInfo(meshPath).Length)return false;using(var source=new FileStream(meshPath,FileMode.Open,FileAccess.Read,FileShare.Read))using(var output=new FileStream(destination,FileMode.CreateNew,FileAccess.Write)){source.Position=offset;byte[] buffer=new byte[131072];long copied=0;while(copied<length){int n=source.Read(buffer,0,(int)Math.Min(buffer.Length,length-copied));if(n==0)throw new EndOfStreamException();output.Write(buffer,0,n);copied+=n;}}if(Hash(destination)==expectedHash)return true;File.Delete(destination);return false;}catch{try{if(File.Exists(destination))File.Delete(destination);}catch{}return false;}}
  async Task<string> InstallContent(Dictionary<string,object> pack,string previous){string id=Str(pack,"id");if(!System.Text.RegularExpressions.Regex.IsMatch(id,"^[a-z][a-z0-9-]{0,40}$"))throw new Exception("Invalid scenery pack ID.");string target=Path.Combine(Root,"content",id);if(ContentMatches(target,pack)){Progress("Checking "+Str(pack,"name")+"...");return target;}string stage=target+".partial-"+Guid.NewGuid().ToString("N");Directory.CreateDirectory(stage);var files=Obj(pack["files"]);if(files.Count>2000)throw new Exception("Scenery pack contains too many files.");try{foreach(var kv in files){string relative=kv.Key.Replace('\\','/');ValidateRelativeFile(relative);var entry=Obj(kv.Value);string dest=Under(stage,relative);Directory.CreateDirectory(Path.GetDirectoryName(dest));string prior=String.IsNullOrEmpty(previous)?null:Under(previous,relative);if(prior!=null&&File.Exists(prior)&&Hash(prior)==Str(entry,"sha256")){File.Copy(prior,dest,true);continue;}if(MigrateLegacyPiece(previous,relative,dest,Str(entry,"sha256")))continue;await Download(entry,dest);}var index=Obj(pack["index"]);File.WriteAllText(Path.Combine(stage,"index.json"),Json.Serialize(index),new UTF8Encoding(false));await Task.Run(()=>{foreach(var kv in files)if(Hash(Under(stage,kv.Key))!=Str(Obj(kv.Value),"sha256"))throw new Exception("Scenery file verification failed.");if(Directory.Exists(target)){string backup=target+".previous-"+Guid.NewGuid().ToString("N");Directory.Move(target,backup);try{Directory.Move(stage,target);}catch{Directory.Move(backup,target);throw;}try{Directory.Delete(backup,true);}catch{}}else Directory.Move(stage,target);});return target;}finally{if(Directory.Exists(stage))Directory.Delete(stage,true);}}
  static void CheckContent(string folder,Dictionary<string,object> pack){if(!ContentMatches(folder,pack))throw new Exception("Scenery content is incomplete or changed. Update the affected content files before opening the editor.");var expected=Obj(pack["files"]);foreach(var file in Directory.GetFiles(folder,"*",SearchOption.AllDirectories)){string rel=file.Substring(folder.Length+1).Replace('\\','/');if(rel!="index.json"&&!expected.ContainsKey(rel))throw new Exception("Unexpected scenery file.");}var stored=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(folder,"index.json")));if(Json.Serialize(stored)!=Json.Serialize(Obj(pack["index"])))throw new Exception("Scenery index does not match its signed channel.");}
  static bool FileSetMatches(string folder,Dictionary<string,object> component){if(!Directory.Exists(folder))return false;var files=Obj(component["files"]);foreach(var kv in files){string path=Under(folder,kv.Key);if(!File.Exists(path)||Hash(path)!=Str(Obj(kv.Value),"sha256"))return false;}return true;}
  static void ValidateRelativeFile(string relative){string normalized=relative.Replace('\\','/');if(normalized.Length==0||normalized.Contains(":")||normalized.StartsWith("/")||normalized.Split('/').Any(x=>x==".."||x=="."||x==""))throw new Exception("Unsafe update file path.");}
  async Task<string> InstallClient(Dictionary<string,object> client,string previous){string target=Path.Combine(Root,"packages","client-"+SafeHash(Str(client,"sha256")));if(FileSetMatches(target,client)){Progress("Checking editor files...");return target;}return await InstallFileSet(client,target,previous,true);}
  async Task<string> InstallFileSet(Dictionary<string,object> component,string target,string previous,bool client){var files=Obj(component["files"]);if(files.Count>2000)throw new Exception("Update contains too many files.");string stage=target+".partial-"+Guid.NewGuid().ToString("N");Directory.CreateDirectory(stage);try{foreach(var kv in files){ValidateRelativeFile(kv.Key);var entry=Obj(kv.Value);string dest=Under(stage,kv.Key);Directory.CreateDirectory(Path.GetDirectoryName(dest));string prior=String.IsNullOrEmpty(previous)?null:Under(previous,kv.Key);if(prior!=null&&File.Exists(prior)&&Hash(prior)==Str(entry,"sha256")){File.Copy(prior,dest,true);continue;}await Download(entry,dest);}foreach(var kv in files)if(Hash(Under(stage,kv.Key))!=Str(Obj(kv.Value),"sha256"))throw new Exception("Update file verification failed.");
#if !TEST_SKIP_PUBLISHER
   if(client)await Task.Run(()=>VerifyPublisher(Path.Combine(stage,"TerrainFoundry.exe")));
#endif
   var allowed=new HashSet<string>(files.Keys,StringComparer.OrdinalIgnoreCase);foreach(var file in Directory.GetFiles(stage,"*",SearchOption.AllDirectories)){string rel=file.Substring(stage.Length+1).Replace('\\','/');if(!allowed.Contains(rel))throw new Exception("Unexpected update file.");}if(Directory.Exists(target)){string backup=target+".previous-"+Guid.NewGuid().ToString("N");Directory.Move(target,backup);try{Directory.Move(stage,target);}catch{Directory.Move(backup,target);throw;}try{Directory.Delete(backup,true);}catch{}}else Directory.Move(stage,target);return target;}finally{if(Directory.Exists(stage))Directory.Delete(stage,true);}}
  static void CheckClient(string folder,Dictionary<string,object> client){if(!FileSetMatches(folder,client))throw new Exception("Editor files are incomplete or changed. Update the editor before opening it.");var expected=new HashSet<string>(Obj(client["files"]).Keys,StringComparer.OrdinalIgnoreCase);foreach(var file in Directory.GetFiles(folder,"*",SearchOption.AllDirectories)){string rel=file.Substring(folder.Length+1).Replace('\\','/');if(!expected.Contains(rel))throw new Exception("Unexpected editor file.");}}
  static Dictionary<string,object> VerifyEnvelope(string envelope){var outer=Json.Deserialize<Dictionary<string,object>>(envelope);byte[] payload=Convert.FromBase64String(Str(outer,"payload")),signature=Convert.FromBase64String(Str(outer,"signature"));using(var rsa=new RSACryptoServiceProvider()){using(var stream=typeof(Launcher).Assembly.GetManifestResourceStream("update-public.xml"))using(var reader=new StreamReader(stream))rsa.FromXmlString(reader.ReadToEnd());if(!rsa.VerifyData(payload,"SHA256",signature))throw new Exception("Release signature invalid.");}return Json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(payload));}
  async Task<string> FetchManifest(){
#if TEST_TRANSPORT
 return await Task.Run(()=>File.ReadAllText(Path.Combine(Environment.GetEnvironmentVariable("TERRAIN_TEST_RELEASE"),"component-channel.json")));
#else
 using(var limited=CancellationTokenSource.CreateLinkedTokenSource(cancellation.Token)){limited.CancelAfter(TimeSpan.FromSeconds(12));using(var response=await http.GetAsync("https://github.com/"+Repo+"/releases/latest/download/component-channel.json",HttpCompletionOption.ResponseHeadersRead,limited.Token)){response.EnsureSuccessStatusCode();using(var input=await response.Content.ReadAsStreamAsync())using(var output=new MemoryStream()){byte[] b=new byte[16384];int n;while((n=await input.ReadAsync(b,0,b.Length,limited.Token))>0){if(output.Length+n>4194304)throw new Exception("Manifest too large.");output.Write(b,0,n);}return Encoding.UTF8.GetString(output.ToArray());}}}
#endif
}
  static string EnvelopeHash(string envelope){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(envelope))).Replace("-","").ToLowerInvariant();}
  static string Summarize(Dictionary<string,object> release){
   long bytes=0;int changedFiles=0,changedClientFiles=0;bool schema2=Convert.ToInt32(release["schema"])==2;bool launcherNeeded=new Version(Str(Obj(release["launcher"]),"version"))>typeof(Launcher).Assembly.GetName().Version;if(launcherNeeded)bytes+=Convert.ToInt64(Obj(release["launcher"])["size"]);
   string currentClient=null;if(File.Exists(StateFile)){try{currentClient=Str(ReadState(),"client");}catch{}}
   bool clientNeeded=true;if(schema2){var clientFiles=Obj(Obj(release["client"])["files"]);foreach(var f in clientFiles){var d=Obj(f.Value);string local=currentClient==null?null:Under(currentClient,f.Key);if(local==null||!File.Exists(local)||Hash(local)!=Str(d,"sha256")){bytes+=Convert.ToInt64(d["size"]);changedClientFiles++;}}clientNeeded=changedClientFiles>0;}else{if(File.Exists(StateFile)){try{var old=VerifyEnvelope(Str(ReadState(),"envelope"));clientNeeded=!String.Equals(Str(Obj(old["client"]),"sha256"),Str(Obj(release["client"]),"sha256"),StringComparison.Ordinal);}catch{}}if(clientNeeded){bytes+=Convert.ToInt64(Obj(release["client"])["size"]);changedClientFiles=1;}}
   var changedPieces=new List<string>();bool contentMetadataChanged=false;Dictionary<string,object> installed=new Dictionary<string,object>();if(File.Exists(StateFile)){try{installed=Obj(ReadState()["assets"]);}catch{}}
   if(schema2){foreach(var item in (System.Collections.IEnumerable)release["assets"]){var pack=Obj(item);string id=Str(pack,"id"),folder=installed.ContainsKey(id)?Convert.ToString(installed[id]):null;var files=Obj(pack["files"]);if(String.IsNullOrEmpty(folder)||!File.Exists(Path.Combine(folder,"index.json")))contentMetadataChanged=true;else try{contentMetadataChanged|=Json.Serialize(Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(folder,"index.json"))))!=Json.Serialize(Obj(pack["index"]));}catch{contentMetadataChanged=true;}foreach(var f in files){var descriptor=Obj(f.Value);string local=folder==null?null:Under(folder,f.Key);if(local==null||!File.Exists(local)||Hash(local)!=Str(descriptor,"sha256")){if(folder==null||!LegacyPieceMatches(folder,f.Key,Str(descriptor,"sha256"))){bytes+=Convert.ToInt64(descriptor["size"]);changedFiles++;if(changedPieces.Count<6)changedPieces.Add(id+" / "+Path.GetFileNameWithoutExtension(f.Key));}}}}}
   else foreach(var item in (System.Collections.IEnumerable)release["assets"]){var pack=Obj(item);if(!File.Exists(Path.Combine(Root,"packages",SafeHash(Str(pack,"sha256")),"verified.json"))){changedFiles++;bytes+=Convert.ToInt64(pack["size"]);}}
   var components=new List<string>();if(launcherNeeded)components.Add("Launcher");if(clientNeeded)components.Add("Editor");if(changedFiles>0||contentMetadataChanged)components.Add("Content");if(components.Count==0)components.Add("release metadata");
   string detail="Scenery: "+(schema2?(changedFiles==0?(contentMetadataChanged?"catalogue changed; no model files need downloading":"up to date"):changedFiles+" changed model file(s)"+(changedPieces.Count>0?" — "+String.Join(", ",changedPieces)+(changedFiles>changedPieces.Count?" and "+(changedFiles-changedPieces.Count)+" more":""):"")):changedFiles+" pack(s) to install/update");
   return "Updates available for: "+String.Join(", ",components)+".\nEditor files changed: "+changedClientFiles+".\n"+detail+".\nEstimated download: "+(bytes/1048576.0).ToString("0.0")+" MB.\n\nWould you like to update now? Your saved scenes are preserved.";
  }
  new async Task Update(){
   if(busy)return;busy=true;cancellation=new CancellationTokenSource();offer.Visible=false;install.Enabled=false;play.Enabled=false;pendingRelease=null;pendingEnvelope=null;
   cancellation.CancelAfter(TimeSpan.FromSeconds(15));
   try{
    Progress("Checking for updates...");
    http.DefaultRequestHeaders.UserAgent.ParseAdd("TerrainFoundryLauncher/"+typeof(Launcher).Assembly.GetName().Version);
    string envelope=await FetchManifest();var release=VerifyEnvelope(envelope);
    if((Convert.ToInt32(release["schema"])!=1&&Convert.ToInt32(release["schema"])!=2)||Str(release,"repository")!=Repo)throw new Exception("Unsupported release.");
    if(File.Exists(StateFile)&&Convert.ToInt64(release["sequence"])<Convert.ToInt64(ReadState()["sequence"]))throw new Exception("Refusing an older update manifest.");
    pendingEnvelope=envelope;pendingRelease=release;
    bool current=File.Exists(StateFile)&&Str(ReadState(),"envelope")==envelope&&new Version(Str(Obj(release["launcher"]),"version"))<=typeof(Launcher).Assembly.GetName().Version;
    status.Text=current?"You are up to date - "+Str(release,"version")+".\n\nOpen the installed editor to start building. Your projects stay on this computer.":Summarize(release);
    install.Text=File.Exists(StateFile)?"Update now":"Install now";install.Enabled=!current;offer.Visible=!current;if(!current&&!File.Exists(StateFile))status.Text=status.Text.Replace("Would you like to update now?", "Install the editor and scenery to get started?");if(current){pendingRelease=null;pendingEnvelope=null;}
   }catch(Exception e){status.Text="Update check unavailable: "+e.Message+(File.Exists(StateFile)?"\nYour installed editor is still available offline.":"\nFirst installation requires internet.");}
   finally{busy=false;StopProgress();play.Enabled=File.Exists(StateFile);}
   if(closeAfterCancel){Close();return;}if(launchAfterCancel){launchAfterCancel=false;Launch();return;}
   if(pendingEnvelope!=null&&approvedChannel=="--approved-channel="+EnvelopeHash(pendingEnvelope)){approvedChannel=null;await ApplyUpdate();}
  }
  async Task ApplyUpdate(){
   if(busy||pendingRelease==null)return;busy=true;cancellation=new CancellationTokenSource();offer.Visible=false;install.Enabled=false;play.Enabled=false;
   try{
    var release=pendingRelease;string envelope=pendingEnvelope;var launcher=Obj(release["launcher"]);
    if(new Version(Str(launcher,"version"))>typeof(Launcher).Assembly.GetName().Version){
     string next=Path.Combine(Root,"TerrainFoundryLauncher-next.exe");await Download(launcher,next);await Task.Run(()=>VerifyPublisher(next));
     if(System.Reflection.AssemblyName.GetAssemblyName(next).Version!=new Version(Str(launcher,"version")))throw new Exception("Launcher version mismatch.");
     string destination=Path.Combine(Root,"TerrainFoundryLauncher.exe");File.Copy(next,destination+".pending",true);
     WriteRestart(destination,EnvelopeHash(envelope));status.Text="Launcher update verified. Restarting to finish your approved update...";busy=false;Close();return;
    }
    var assets=new Dictionary<string,string>();string client;
    if(Convert.ToInt32(release["schema"])==2){
     string previousClient=null;Dictionary<string,object> oldAssets=new Dictionary<string,object>();if(File.Exists(StateFile)){try{var priorState=ReadState();previousClient=Str(priorState,"client");oldAssets=Obj(priorState["assets"]);}catch{}}
     client=await InstallClient(Obj(release["client"]),previousClient);
     foreach(var item in (System.Collections.IEnumerable)release["assets"]){var pack=Obj(item);string id=Str(pack,"id"),previous=oldAssets.ContainsKey(id)?Convert.ToString(oldAssets[id]):null;assets.Add(id,await InstallContent(pack,previous));}
     var state=new Dictionary<string,object>{{"schema",2},{"sequence",release["sequence"]},{"version",release["version"]},{"client",client},{"assets",assets},{"envelope",envelope}};Atomic(StateFile,Json.Serialize(state));
    }else{
     batchTotal=Convert.ToInt64(Obj(release["client"])["size"]);batchCount=1;batchComplete=0;batchDone=0;batchCurrent=0;foreach(var item in (System.Collections.IEnumerable)release["assets"]){batchTotal+=Convert.ToInt64(Obj(item)["size"]);batchCount++;}
     client=await InstallTracked(Obj(release["client"]),true);foreach(var item in (System.Collections.IEnumerable)release["assets"]){var pack=Obj(item);assets.Add(Str(pack,"id"),await InstallTracked(pack,false));}
     var state=new Dictionary<string,object>{{"schema",1},{"sequence",release["sequence"]},{"version",release["version"]},{"client",client},{"assets",assets},{"envelope",envelope}};Atomic(StateFile,Json.Serialize(state));
    }
    status.Text="Ready - "+Str(release,"version")+".\n\nLauncher, editor and scenery update independently. Only changed scenery files are downloaded. Your scenes remain on this PC.";pendingRelease=null;pendingEnvelope=null;
   }catch(Exception e){status.Text="Update not applied: "+e.Message+(File.Exists(StateFile)?"\nYour installed editor is still available offline.":"\nYou can retry the installation.");}
   finally{batchTotal=0;batchCurrent=0;busy=false;StopProgress();offer.Visible=pendingRelease!=null;install.Text="Retry update";install.Enabled=pendingRelease!=null;play.Enabled=File.Exists(StateFile);if(closeAfterCancel)Close();else if(launchAfterCancel){launchAfterCancel=false;Launch();}}
  }
static void WriteRestart(string target,string approvedHash){
   var helper=new ProcessStartInfo(Path.Combine(Root,"TerrainFoundryLauncher-next.exe")){UseShellExecute=false,CreateNoWindow=true,WorkingDirectory=Root};
   helper.Arguments="--finish-launcher-update="+Process.GetCurrentProcess().Id+" --approved-channel="+SafeHash(approvedHash);
   using(var process=Process.Start(helper)){if(process==null)throw new Exception("Could not start the launcher update helper.");}
  }
  static void ReplaceLauncherFile(string pending,string target,string expectedHash){
   if(Hash(pending)!=SafeHash(expectedHash))throw new Exception("The staged launcher changed before replacement.");
   var deadline=DateTime.UtcNow.AddSeconds(30);
   for(;;){try{if(File.Exists(target))File.Replace(pending,target,target+".previous");else File.Move(pending,target);return;}
    catch(IOException){if(DateTime.UtcNow>=deadline)throw;Thread.Sleep(250);}
    catch(UnauthorizedAccessException){if(DateTime.UtcNow>=deadline)throw;Thread.Sleep(250);}
   }
  }
  static void FinishLauncherUpdate(string[] args){
   try{
    if(args.Length!=2||!args[1].StartsWith("--approved-channel="))throw new Exception("Invalid update handoff.");
    int parent=Int32.Parse(args[0].Substring("--finish-launcher-update=".Length));string approval=SafeHash(args[1].Substring("--approved-channel=".Length));
    string source=Path.GetFullPath(typeof(Launcher).Assembly.Location),target=Path.Combine(Root,"TerrainFoundryLauncher.exe"),pending=target+".pending";
    if(!String.Equals(source,Path.GetFullPath(Path.Combine(Root,"TerrainFoundryLauncher-next.exe")),StringComparison.OrdinalIgnoreCase))throw new Exception("Update helper is outside the installation folder.");
    try{using(var old=Process.GetProcessById(parent)){if(!old.WaitForExit(30000))throw new Exception("The previous launcher did not close.");}}catch(ArgumentException){}
#if !TEST_HANDOFF
    VerifyPublisher(source);
#endif
    string expected=Hash(source);ReplaceLauncherFile(pending,target,expected);
    var start=new ProcessStartInfo(target,"--approved-channel="+approval){UseShellExecute=false,WorkingDirectory=Root};
    using(var next=Process.Start(start)){if(next==null)throw new Exception("The updated launcher could not be opened.");}
    File.WriteAllText(Path.Combine(Root,"launcher-update.log"),"Launcher replacement completed. Version "+typeof(Launcher).Assembly.GetName().Version);
   }catch(Exception e){
    Environment.ExitCode=1;string message="Launcher update could not finish: "+e.Message+"\nRun the latest Terrain Foundry MSI installer to repair the launcher. Your saved projects are preserved.";
    try{File.WriteAllText(Path.Combine(Root,"launcher-update.log"),message);}catch{}
#if !TEST_HANDOFF
    MessageBox.Show(message,"Terrain Foundry update",MessageBoxButtons.OK,MessageBoxIcon.Error);
#endif
   }
  }
  async Task OpenVerifiedEditor(string client,Dictionary<string,object> assets){var start=new ProcessStartInfo(Path.Combine(client,"TerrainFoundry.exe")){UseShellExecute=false,WorkingDirectory=client};start.EnvironmentVariables["TERRAIN_ASSET_PACKS"]=Json.Serialize(assets);using(var editor=Process.Start(start)){if(editor==null)throw new Exception("The editor could not be started. Please try again.");await Task.Run(()=>{try{editor.WaitForInputIdle(5000);}catch(InvalidOperationException){}});if(editor.HasExited)throw new Exception("The editor closed during startup. Your launcher remains available; please try again.");}busy=false;Close();}
  async void Launch(){if(busy)return;busy=true;play.Enabled=false;offer.Visible=false;Progress("Checking installed editor and scenery...");try{var state=ReadState();string client=Str(state,"client");var release=VerifyEnvelope(Str(state,"envelope"));if(Convert.ToInt32(release["schema"])==2)await Task.Run(()=>CheckClient(client,Obj(release["client"])));else await Task.Run(()=>CheckInventory(client,Obj(release["client"])));var assets=Obj(state["assets"]);foreach(var a in (System.Collections.IEnumerable)release["assets"]){var pack=Obj(a);string folder=Convert.ToString(assets[Str(pack,"id")]);if(Convert.ToInt32(release["schema"])==2)await Task.Run(()=>CheckContent(folder,pack));else await Task.Run(()=>CheckInventory(folder,pack));}await OpenVerifiedEditor(client,assets);}catch(Exception e){status.Text=e.Message;}finally{busy=false;StopProgress();play.Enabled=File.Exists(StateFile);}}
 }
}
