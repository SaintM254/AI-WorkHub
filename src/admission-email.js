// Server resolves the approved student, verified recipient and private PDF.
// Never send a recipient or attachment from client-supplied values.
export async function sendAdmissionEmail(client, letterId) {
  const {data,error}=await client.functions.invoke('send-admission-letter',{body:{letterId}});
  if(error){
    let message='Email was not confirmed. Check the email function deployment and provider setup.';
    try {
      const response=await error.context?.json();
      if(response?.code==='email_not_configured') message='Email delivery is not configured yet. Add the email provider secrets to the Edge Function.';
      else if(response?.code==='delivery_uncertain') message='Email result is uncertain. Check the provider dashboard before retrying.';
      else if(response?.code==='already_processing') message='This email is already being processed. Refresh its status before retrying.';
      else if(response?.code==='provider_rejected') message='The email provider rejected the request. Check sender verification, quota and provider logs.';
    } catch {}
    throw new Error(message);
  }
  if(!data?.accepted) throw new Error('Email was not accepted.');
  return data;
}
