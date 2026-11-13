import { redirect } from 'next/navigation';

// Finding a ride now happens on the RideShare page itself; old links land there
export default function FindRideRedirect() {
  redirect('/rides');
}
