$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$out=Join-Path $PSScriptRoot '../../launcher/generated'
New-Item -ItemType Directory -Force $out | Out-Null
$images=@()
foreach($size in @(16,24,32,48,64,128,256)){
  $bitmap=New-Object Drawing.Bitmap($size,$size)
  $g=[Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.ScaleTransform($size/256.0,$size/256.0)
  $dark=New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#10271F'))
  $gold=New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#D8B66F'))
  $shadow=New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#8C703F'))
  $light=New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#F4DCA0'))
  $tile=New-Object Drawing.Drawing2D.GraphicsPath
  $tile.AddArc(4,4,48,48,180,90);$tile.AddArc(204,4,48,48,270,90)
  $tile.AddArc(204,204,48,48,0,90);$tile.AddArc(4,204,48,48,90,90);$tile.CloseFigure()
  $g.FillPath($dark,$tile)
  $border=New-Object Drawing.Pen([Drawing.ColorTranslator]::FromHtml('#D8B66F'),4)
  $g.DrawPath($border,$tile)
  $base=[Drawing.PointF[]]@([Drawing.PointF]::new(31,187),[Drawing.PointF]::new(128,224),[Drawing.PointF]::new(225,187),[Drawing.PointF]::new(128,152))
  $g.FillPolygon($shadow,$base)
  $g.FillRectangle($gold,49,80,48,100);$g.FillRectangle($gold,159,80,48,100)
  $g.FillRectangle($gold,91,113,74,74)
  foreach($x in @(49,80,159,190)){$g.FillRectangle($gold,$x,63,17,26)}
  $g.FillRectangle($light,49,93,48,7);$g.FillRectangle($light,159,93,48,7)
  $g.FillRectangle($dark,66,117,14,25);$g.FillRectangle($dark,176,117,14,25)
  $g.FillEllipse($dark,111,139,34,36);$g.FillRectangle($dark,111,155,34,35)
  $gem=[Drawing.PointF[]]@([Drawing.PointF]::new(128,30),[Drawing.PointF]::new(139,44),[Drawing.PointF]::new(128,58),[Drawing.PointF]::new(117,44))
  $g.FillPolygon($light,$gem)
  $stream=New-Object IO.MemoryStream
  $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
  $images+=,@{size=$size;bytes=$stream.ToArray()}
  if($size -eq 256){$bitmap.Save((Join-Path $out 'terrain-foundry.png'),[Drawing.Imaging.ImageFormat]::Png)}
  $stream.Dispose();$g.Dispose();$bitmap.Dispose();$tile.Dispose();$border.Dispose()
  foreach($brush in @($dark,$gold,$shadow,$light)){$brush.Dispose()}
}
$file=[IO.File]::Create((Join-Path $out 'terrain-foundry.ico'))
$writer=New-Object IO.BinaryWriter($file)
$writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$images.Count)
$offset=6+16*$images.Count
foreach($image in $images){
  $dimension=if($image.size -eq 256){0}else{$image.size}
  $writer.Write([byte]$dimension);$writer.Write([byte]$dimension);$writer.Write([byte]0);$writer.Write([byte]0)
  $writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$image.bytes.Length);$writer.Write([uint32]$offset)
  $offset+=$image.bytes.Length
}
foreach($image in $images){$writer.Write([byte[]]$image.bytes)}
$writer.Dispose()
