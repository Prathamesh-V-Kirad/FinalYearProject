import { useAuth } from '@/context/AuthContext';
import ToogleCard from './ToogleCard';
import api from '@/lib/api';
import { useToast } from "@/components/ui/use-toast"
import { ToastAction } from '../ui/toast';
import { useEffect, useState } from 'react';
import getUrlParams from '@/helpers/getUrlParams';
import { useNavigate } from 'react-router-dom';

type Toggle = {
  title : string;
  img : string;
  isAdded : boolean;
  callback : () => void;
}

type User = {
  name: string;
  email: string;
};

type UserAuth = {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

declare global {
  interface Window {
    google: any;
  }
}

export default function Destination() {
  const [ytAdded, setYtAdded] = useState<boolean>(false);
  const [twitchAdded, setTwitchAdded] = useState<boolean>(false);
  const [fbAdded, setFbAdded] = useState<boolean>(false);

  const { toast } = useToast();
  const auth = useAuth();
  const navigate = useNavigate();

  console.log(auth);

  //Uncomment to check your google client id
  //console.log("Your google client id : " + import.meta.env.VITE_GOOGLE_CLIENT_ID);

  useEffect(() => {
    if(window.location.href.includes('?code')){
      console.log("Inside if condition useEffect");
      console.log(window.location.href);
      const code = getUrlParams('code');
      console.log("Found Twitch code", code);
      // setTimeout(() => {
        if(code){
          sendTwitchCode(code);
          console.log("Code sent successfully");
        }
      // }, 2000);
      navigate('/destination');
    }
  },[]);

  useEffect(() => {
    if(auth){
      updateDestinations(auth);
    }
  },[]);

  const cards : Toggle[] = [
    {
      title : "YouTube",
      img : "https://www.ohmystream.co/static/media/youtube.bdc1f583e488e2e672cff695a1c379d1.svg",
      isAdded : ytAdded,
      callback : handleYoutubeAuth
    },
    {
      title : "Twitch",
      img : "https://www.ohmystream.co/static/media/twitch.ad8ab2f2e67d7ee904a135ed5bcd2c1f.svg",
      isAdded : twitchAdded,
      callback : handleTwitchAuth
    },
    {
      title : "Facebook",
      img : "https://www.ohmystream.co/static/media/facebook.c3402e464658a657669832c282de64a7.svg",
      isAdded : fbAdded,
      callback : handleFacebookAuth
    }
  ];

  async function getDestinations(name : string | undefined, email : string | undefined){
    const payload = {
      user_name : name,
      user_email : email
    }

    try {
      const response = await api.post('/destinations/', payload);
      console.log(response.data);
      return response.data;
    } catch (error) {
      console.error("Error in getting destinations : ", error);
    }
  }

  async function removeDestinations(platform : string , name : string | undefined , email : string | undefined){
    
    const payload = {
      platform : platform,
      user_name : name,
      user_email : email
    }

    try {
      const response = await api.post('/destinations/remove', payload);
      if(response.data)
      return response.data;
    } catch (error) {
      console.error("Error in removing destinations : ", error);
    }
  }

  async function updateDestinations(auth : UserAuth){
    const destination = await getDestinations(auth?.user?.name, auth?.user?.email);
    if(destination.youtube){
      setYtAdded(true);
      console.log("Youtube added from db" , destination.youtube);
    }
    if(destination.facebook){
      setFbAdded(true);
      console.log("Facebook added from db" , destination.facebook);
    }
    if(destination.twitch){
      setTwitchAdded(true);
      console.log("Twitch added from db" , destination.twitch);
    }
  }


  //Youtube Auth
  function handleYoutubeAuth(){
    /*global google*/ 
    console.log("Inside Youtube Auth function");

    if(ytAdded){
      toast({
        title : "Youtube is already added as destination!",
        description : "Do you want to remove youtube from destination",
        action : <ToastAction onClick={() => setYtAdded(false)} altText="Remove">Remove</ToastAction>
      });
      return;
    }

    if(window.google){
      // This is client obj conataining config for youtube auth
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
        ux_mode: 'popup',
        callback: (response : any) => {
          console.log('Response : ', response);
          const payload = {
            code : response.code,
            user_name : auth?.user?.name,
            user_email : auth?.user?.email
          }

          // Send auth code to your backend platform using Axios
          api.post('/authorize/yt', payload)
          .then((axiosResponse) => {
            console.log(axiosResponse.data);
            toast({
              title: "Youtube added as destination",
            });
            setYtAdded(true);
          })
          .catch(function (error) {
            console.error('Error signing in:', error);
            toast({
              variant: "destructive",
              title: "Uh oh! Something went wrong.",
              description: "There was a problem with your request.",
              action: <ToastAction onClick={handleYoutubeAuth} altText="Try again">Try again</ToastAction>,
            });
          });
        }
      });

      // This function is used to request an authorization code
      client.requestCode();
    }
    else {
      console.log('Google not found');
    }
  }


  //Twitch Redirect url
  function handleTwitchAuth(){

    console.log("Inside Twitch Auth function");

    if(twitchAdded){
      toast({
        title : "Twitch is already added as destination!",
        description : "Do you want to remove twitch from destination",
        action : <ToastAction onClick={() => setTwitchAdded(false)} altText="Remove">Remove</ToastAction>
      });
      return;
    }

    const TWITCH_SCOPE = encodeURIComponent(
      'channel:manage:broadcast channel:read:stream_key'
    );
  
    console.log(TWITCH_SCOPE);

    const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID.trim();
    const redirectUri = 'http://localhost:5173/destination'.trim();
    const twitchScope = TWITCH_SCOPE.trim();

    console.log('clientId:', clientId);
    console.log('redirectUri:', redirectUri);
    console.log('twitchScope:', twitchScope);

    const twitchAuthURL = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${twitchScope}&force_verify=true`;

    console.log('twitchAuthURL:', twitchAuthURL);

    window.location.href = twitchAuthURL;
  }


  //Twitch Auth Code
  function sendTwitchCode(TWITCH_CODE? : string){
    setTimeout(() => {
      
    }, 2000);
    const payload = {
      code : TWITCH_CODE,
      user_name : auth?.user?.name,
      user_email : auth?.user?.email
    }

    api.post('authorize/twitch', payload)
    .then((response) => {
        console.log(response.data);
        setTwitchAdded(true);
        toast({
          title: "Twitch added as destination",
        });
    })
    .catch((error) => {
      console.error('Error signing in:', error);
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem with your request.",
        action: <ToastAction onClick={handleTwitchAuth} altText="Try again">Try again</ToastAction>,
      });
    });
  }


  //Facebook Auth
  function handleFacebookAuth(){
    if(fbAdded){
      toast({
        title : "Facebook is already added as destination!",
        description : "Do you want to remove facebook from destination",
        action : <ToastAction onClick={() => setFbAdded(false)} altText="Remove">Remove</ToastAction>
      });
      return;
    }
    setFbAdded(true);
    console.log("Facebook Auth");
    toast({
      title: "Facebook added as destination",
    });
  }

  return (
    <div className='p-6'>
        <h2 className='text-3xl font-semibold tracking-tight'>Add a Destination</h2>
        <div className='flex py-4 gap-3'>
            {cards.map((card) => {
              return (<ToogleCard key={card.title} isSet={card.isAdded} title={card.title} img={card.img} onClick={card.callback}/>);    
            })}
        </div>
    </div>
  )
}