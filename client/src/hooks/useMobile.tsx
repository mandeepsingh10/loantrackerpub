import { useState, useEffect } from "react";

/**
 * Custom hook to check if the current device is a mobile device
 * based on window width (less than 768px is considered mobile)
 */
export const useMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Function to check if window width is mobile size
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Check on initial load
    checkMobile();

    // Add event listener for window resize
    window.addEventListener("resize", checkMobile);

    // Clean up event listener
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
};
