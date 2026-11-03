import json, math, datetime, urllib.parse as up
def val(v,i,j):
    v=v.lower()
    if 'direction' in v: return (200+j*7+i*3)%360
    if 'gust' in v: return 14+((i+j)%7)
    if 'wind_speed' in v or 'windspeed' in v: return 6+((i*3+j*2)%11)
    if 'wave_height' in v: return round(0.2+((i+j)%9)*0.12,2)
    if 'period' in v: return 4+(j%4)
    if 'pressure' in v: return round(1016-0.15*j+0.1*i,1)
    if 'current_velocity' in v: return round(0.1+((i+j)%6)*0.08,2)
    if 'sea_surface' in v: return round(21.0+(i%8)*0.35+(i//8)*0.1,2)
    if 'temperature' in v: return 22.5
    if 'cloud' in v: return 30
    if 'precip' in v or 'rain' in v: return 0
    if 'code' in v: return 1
    if 'visib' in v: return 20000
    return 1
def respond(route):
    u=route.request.url; q=dict(up.parse_qsl(up.urlparse(u).query))
    lats=str(q.get('latitude','34.7')).split(','); lons=str(q.get('longitude','32.5')).split(',')
    hv=[x for x in q.get('hourly','').split(',') if x]; cv=[x for x in q.get('current','').split(',') if x]; mv=[x for x in q.get('minutely_15','').split(',') if x]
    now=datetime.datetime.utcnow().replace(minute=0,second=0,microsecond=0); st=now-datetime.timedelta(hours=int(q.get('past_hours',0) or 0)+ 24*int(q.get('past_days',0) or 0))
    n=int(q.get('forecast_hours',0) or 0) or 24*int(q.get('forecast_days',3) or 3)+int(q.get('past_hours',0) or 0)
    ts=[(st+datetime.timedelta(hours=k)).strftime('%Y-%m-%dT%H:%M') for k in range(n)]
    out=[]
    for i,(la,lo) in enumerate(zip(lats,lons)):
        o={'latitude':float(la),'longitude':float(lo),'utc_offset_seconds':0,'timezone':'GMT'}
        if hv: o['hourly']={'time':ts}; [o['hourly'].__setitem__(v,[val(v,i,k) for k in range(n)]) for v in hv]
        if cv: o['current']={'time':now.strftime('%Y-%m-%dT%H:%M')}; [o['current'].__setitem__(v,val(v,i,0)) for v in cv]
        if mv: o['minutely_15']={'time':ts}; [o['minutely_15'].__setitem__(v,[val(v,i,k) for k in range(n)]) for v in mv]
        out.append(o)
    route.fulfill(json=out if len(out)>1 else out[0])
