import base64,collections,json,re,sys
class Sanitizer:
 def __init__(self):self.counts=collections.Counter()
 def text(self,value):
  rules=[('session-cookie',r'(?i)((?:__Secure-)?klisteni(?:-[a-z0-9_-]+)?\.session_token\s*=\s*)[^;\s\"\'<>]+',r'\1[REDACTED]'),('request-header',r'(?im)(\b(?:cookie|set-cookie|authorization)\s*:\s*)[^\r\n]+',r'\1[REDACTED]'),('private-url-token',r'(?i)([#?&]token=)[^&#\s\"\'<>\)]+',r'\1[REDACTED]'),('database-url',r'postgres(?:ql)?://[^\s\"\'<>]+','[REDACTED task database URL]'),('fixture-password',r'b2b-product-synthetic-password-\d{4}','[REDACTED fixture password]'),('quoted-auth-field',r'''(?i)((?:["'])(?:password|currentPassword|newPassword|token|accessToken|refreshToken|sessionToken|invitationToken|secret)(?:["'])\s*:\s*["'])[^"'\r\n]+''',r'\1[REDACTED]')]
  for kind,pattern,replacement in rules:
   value,n=re.subn(pattern,replacement,value);self.counts[kind]+=n
  return value
 def value(self,x):
  if isinstance(x,str):return self.text(x)
  if isinstance(x,list):return [self.value(v) for v in x]
  if isinstance(x,dict):
   result={k:self.value(v) for k,v in x.items()}
   for k in result:
    if k.lower() in ('cookie','set-cookie','authorization','proxy-authorization') and result[k] is not None:
     result[k]='[REDACTED]';self.counts['structured-header']+=1
    if re.fullmatch(r'(?i)(?:password|current.?password|new.?password|token|access.?token|refresh.?token|session.?token|invitation.?token|secret|b2b.?auth.?secret)',k) and result[k] is not None:
     result[k]='[REDACTED]';self.counts['structured-auth-field']+=1
   if isinstance(x.get('name'),str) and x['name'].lower() in ('cookie','set-cookie','authorization','proxy-authorization') and 'value' in result:
    result['value']='[REDACTED]';self.counts['named-header']+=1
   if isinstance(x.get('name'),str) and re.search(r'(?i)(?:session_token|session-token)$',x['name']) and 'value' in result:
    result['value']='[REDACTED]';self.counts['named-session-cookie']+=1
   if x.get('type')=='text' and isinstance(x.get('text'),str):result['text']=self.text(x['text'])
   if isinstance(x.get('body'),str) and x.get('contentType','').startswith(('application/json','text/')):
    try:
     raw=base64.b64decode(x['body'],validate=True);txt=raw.decode();before=sum(self.counts.values())
     safe=json.dumps(self.value(json.loads(txt)),ensure_ascii=False) if x['contentType'].startswith('application/json') else self.text(txt)
     if sum(self.counts.values())>before:result['body']=base64.b64encode(safe.encode()).decode()
    except (ValueError,UnicodeDecodeError):pass
   return result
  return x
 def report(self):return {k:v for k,v in self.counts.items() if v}
if __name__=='__main__':
 sample={'stats':{'expected':2,'unexpected':1},'results':[{'status':'failed','error':'socket hang up\n - cookie: klisteni-b2b.session_token=sample-cookie\n - origin: http://example.test\n - authorization: Bearer sample-secret\n /app/invite#token=sample-invite','operationId':'public-operation'}]}
 s=Sanitizer();safe=s.value(sample);encoded=json.dumps(safe);assert all(v not in encoded for v in ['sample-cookie','sample-secret','sample-invite']);assert safe['stats']==sample['stats'];assert safe['results'][0]['status']=='failed' and safe['results'][0]['operationId']=='public-operation';assert 'socket hang up' in safe['results'][0]['error']
 plain=Sanitizer().text(' - cookie: abc=sample-other\n status:failed');assert 'sample-other' not in plain and 'status:failed' in plain
 structured={'headers':{'cookie':'sample-cookie','Authorization':'sample-secret'},'requestHeaders':[{'name':'Cookie','value':'sample-header'}],'cookies':[{'name':'klisteni-b2b.session_token','value':'sample-cookie-value'}]}
 encoded=json.dumps(Sanitizer().value(structured));assert not any(v in encoded for v in ['sample-cookie','sample-secret','sample-header','sample-cookie-value'])
 auth={'password':'sample-password','currentPassword':'sample-current','token':'sample-token','sessionToken':'sample-session','operationId':'public-operation','snapshotHash':'public-hash'};safe=Sanitizer().value(auth);assert not any(v in json.dumps(safe) for v in ['sample-password','sample-current','sample-token','sample-session']);assert safe['operationId']==auth['operationId'] and safe['snapshotHash']==auth['snapshotHash']
 encoded=json.dumps(Sanitizer().text('payload {"password":"sample-password","token":"sample-token"}'));assert 'sample-password' not in encoded and 'sample-token' not in encoded
 print(json.dumps({'selfTests':'passed','preserved':'case status,counts,operation identity,error class','redactionKinds':s.report()}))
