export type Coordinates = {lat:number;lng:number};
export function parseCoordinates(value:unknown):Coordinates|null {
 if(typeof value!=="string")return null;
 const match=/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*$/.exec(value);
 if(!match)return null;
 const lat=Number(match[1]),lng=Number(match[2]);
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
export function normalizeCoordinates(value:unknown):string {
 const point=parseCoordinates(value);
 if(!point)throw Error('พิกัดต้องเป็น ละติจูด,ลองจิจูด เช่น 13.7097601,100.8135513 โดยละติจูดอยู่ระหว่าง −90 ถึง 90 และลองจิจูด −180 ถึง 180');
 return String(point.lat)+','+String(point.lng);
}

// Great-circle distance on the mean-radius spherical Earth, returned in kilometers.
export function distanceKilometers(from:unknown,to:unknown):number{const a=parseCoordinates(from),b=parseCoordinates(to);if(!a||!b)throw Error('DISTANCE ต้องใช้พิกัด ละติจูด,ลองจิจูด ที่ถูกต้อง เช่น 13.7097601,100.8135513');const radians=(degrees:number)=>degrees*Math.PI/180,dlat=radians(b.lat-a.lat),dlng=radians(b.lng-a.lng),h=Math.sin(dlat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dlng/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));}
