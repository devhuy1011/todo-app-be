export function snakeToCamel(data, deep= false) {
  if(!data || data instanceof Array){
    return data;
  }
  let camelObj = {};
  for (let key in data) {
    const t = key.split("_");
    const nk = t.map((e, index) => index == 0 ? e : `${e.charAt(0).toUpperCase()}${e.slice(1)}`).join("");
    if(deep){
      if (typeof data[key] == 'object' && !(data[key] instanceof Date)) {
        camelObj[nk]=snakeToCamel(data[key],deep);
      }else{
        camelObj[nk] = data[key];
      }
    }else{
      camelObj[nk]=data[key];
    }
  }
  return camelObj;
}