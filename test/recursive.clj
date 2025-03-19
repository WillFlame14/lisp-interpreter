(let [add1 (fn g [x i]
             (if (= i 0) 
               x 
               (g (+ x 1) (- i 1))))]
  (print (add1 4 1)))